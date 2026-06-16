const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    // 1. Historical Spending Trend (Last 6 Months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0,0,0,0);

    const expenses = await prisma.expense.findMany({
      where: { userId, date: { gte: sixMonthsAgo } },
      orderBy: { date: 'asc' }
    });

    const monthlyTrendsMap = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Initialize last 6 months with 0
    let tempDate = new Date(sixMonthsAgo);
    for (let i = 0; i < 6; i++) {
       const key = `${monthNames[tempDate.getMonth()]} ${tempDate.getFullYear()}`;
       monthlyTrendsMap[key] = 0;
       tempDate.setMonth(tempDate.getMonth() + 1);
    }

    expenses.forEach(exp => {
       const d = new Date(exp.date);
       const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
       if (monthlyTrendsMap[key] !== undefined) {
          monthlyTrendsMap[key] += exp.amount;
       }
    });

    const spendingTrends = Object.keys(monthlyTrendsMap).map(k => ({
       month: k,
       spent: monthlyTrendsMap[k]
    }));

    // 2. Evaluate Badges (Achievements)
    const badges = [];

    // Streak Badges
    badges.push({
       id: 'streak_3',
       title: 'Streak Starter',
       description: 'Reached a 3-day streak.',
       icon: '🔥',
       unlocked: profile.longestStreak >= 3
    });
    badges.push({
       id: 'streak_7',
       title: 'Habit Master',
       description: 'Reached a 7-day streak.',
       icon: '🏆',
       unlocked: profile.longestStreak >= 7
    });

    // Budget Badges
    const currentMonthKey = `${monthNames[new Date().getMonth()]} ${new Date().getFullYear()}`;
    const spentThisMonth = monthlyTrendsMap[currentMonthKey] || 0;
    badges.push({
       id: 'budget_safe',
       title: 'Frugal Master',
       description: 'Stayed under budget this month.',
       icon: '💰',
       unlocked: spentThisMonth < profile.monthlyBudgetLimit
    });

    // Water Badge
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayLog = await prisma.dailyLog.findUnique({ where: { userId_date: { userId, date: today } } });
    badges.push({
       id: 'water_hero',
       title: 'Hydration Hero',
       description: 'Drank 8 glasses of water today.',
       icon: '💧',
       unlocked: (todayLog?.waterGlasses || 0) >= 8
    });

    res.json({
       spendingTrends,
       badges
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

module.exports = router;
