const express = require('express');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const Tesseract = require('tesseract.js');

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// Add Expense
router.post('/', async (req, res) => {
  const { categoryId, amount, description, date } = req.body;
  try {
    const expense = await prisma.expense.create({
      data: {
        userId: req.user.userId,
        categoryId,
        amount: parseFloat(amount),
        description,
        date: new Date(date)
      },
      include: { category: true }
    });
    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// Scan Receipt OCR
router.post('/scan-receipt', upload.single('receipt'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  try {
    const result = await Tesseract.recognize(req.file.buffer, 'eng');
    const text = result.data.text;
    
    const regex = /TOTAL[\s\S]*?(\d+\.\d{2})/i;
    const match = text.match(regex);
    
    let amount = null;
    if (match && match[1]) {
      amount = parseFloat(match[1]);
    } else {
      const allNumbers = [...text.matchAll(/\d+\.\d{2}/g)].map(m => parseFloat(m[0]));
      if (allNumbers.length > 0) {
        amount = Math.max(...allNumbers);
      }
    }

    res.json({ amount, text });
  } catch (error) {
    console.error('OCR Error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// List Expenses
router.get('/', async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: { userId: req.user.userId },
      include: { category: true },
      orderBy: { date: 'desc' }
    });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// List Categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.expenseCategory.findMany();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Budget Forecast
router.get('/forecast', async (req, res) => {
  try {
    const profile = await prisma.userProfile.findUnique({ where: { userId: req.user.userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const [expenses, subscriptions] = await Promise.all([
      prisma.expense.findMany({
        where: { userId: req.user.userId, date: { gte: startOfMonth, lte: currentDate } }
      }),
      prisma.subscription.findMany({
        where: { userId: req.user.userId, isActive: true }
      })
    ]);

    const totalSpentSoFar = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    let upcomingSubscriptionCosts = 0;
    subscriptions.forEach(sub => {
      const subMonth = new Date(sub.nextBillingDate).getMonth();
      const subYear = new Date(sub.nextBillingDate).getFullYear();
      if (subMonth === currentDate.getMonth() && subYear === currentDate.getFullYear()) {
        if (new Date(sub.nextBillingDate).getDate() > currentDate.getDate()) {
          upcomingSubscriptionCosts += sub.amount;
        }
      } else if (sub.billingCycle === 'MONTHLY') {
         upcomingSubscriptionCosts += sub.amount;
      }
    });

    const monthlyBudgetLimit = profile.monthlyBudgetLimit;
    const currentDay = currentDate.getDate();
    const daysInMonth = endOfMonth.getDate();
    const effectiveDay = currentDay === 1 && totalSpentSoFar === 0 ? 1 : currentDay;
    
    const dailyAverageSpending = totalSpentSoFar / effectiveDay;
    const forecastAmount = (dailyAverageSpending * daysInMonth) + upcomingSubscriptionCosts;
    
    const isOverBudgetRisk = forecastAmount > monthlyBudgetLimit;
    let message = "Your spending is on track.";

    if (isOverBudgetRisk) {
      message = `Warning: You are projected to exceed your budget by $${(forecastAmount - monthlyBudgetLimit).toFixed(2)}.`;
    } else if (upcomingSubscriptionCosts > 0) {
      message += ` Heads up: You have $${upcomingSubscriptionCosts.toFixed(2)} in upcoming subscriptions this month.`;
    }

    res.json({
      totalSpentSoFar: parseFloat(totalSpentSoFar.toFixed(2)),
      monthlyBudgetLimit,
      forecastAmount: parseFloat(forecastAmount.toFixed(2)),
      dailyAverageSpending: parseFloat(dailyAverageSpending.toFixed(2)),
      upcomingSubscriptionCosts: parseFloat(upcomingSubscriptionCosts.toFixed(2)),
      isOverBudgetRisk,
      message
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate forecast', details: error.message });
  }
});

module.exports = router;
