const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/chat', authenticateToken, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ reply: "Please say something!" });

  const query = message.toLowerCase();
  const userId = req.user.userId;

  try {
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ reply: "Profile not found. Please set up your account." });

    // 1. Budget Keywords
    if (query.includes('budget') || query.includes('spend') || query.includes('left') || query.includes('money')) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
      
      const expenses = await prisma.expense.findMany({
        where: { userId, date: { gte: startOfMonth } }
      });
      const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
      const remaining = profile.monthlyBudgetLimit - totalSpent;
      
      if (remaining > 0) {
        return res.json({ reply: `You have spent $${totalSpent.toFixed(2)} this month. You have **$${remaining.toFixed(2)}** left to spend safely! Keep it up. 💸` });
      } else {
        return res.json({ reply: `Warning! You have spent $${totalSpent.toFixed(2)}, exceeding your limit of $${profile.monthlyBudgetLimit.toFixed(2)}. Time to cut back! 🛑` });
      }
    }

    // 2. Calorie Keywords
    if (query.includes('calorie') || query.includes('eat') || query.includes('food') || query.includes('diet')) {
      const today = new Date();
      today.setHours(0,0,0,0);

      const logs = await prisma.foodLog.findMany({
        where: { userId, date: { gte: today } },
        include: { foodItem: true }
      });
      
      const consumed = logs.reduce((sum, log) => sum + (log.amountGrams / 100 * log.foodItem.caloriesPer100g), 0);
      
      // Basic TDEE rough estimate (Mifflin-St Jeor)
      const s = profile.gender === 'MALE' ? 5 : -161;
      const bmr = (10 * profile.weightKg) + (6.25 * profile.heightCm) - (5 * profile.age) + s;
      const multipliers = { SEDENTARY: 1.2, LIGHTLY_ACTIVE: 1.375, MODERATELY_ACTIVE: 1.55, VERY_ACTIVE: 1.725, EXTRA_ACTIVE: 1.9 };
      let tdee = bmr * (multipliers[profile.activityLevel] || 1.2);
      
      if (profile.weightGoal === 'LOSE_WEIGHT') tdee -= 500;
      if (profile.weightGoal === 'GAIN_WEIGHT') tdee += 500;
      
      const remainingCals = Math.max(0, tdee - consumed);
      
      return res.json({ reply: `You have consumed **${Math.round(consumed)} kcal** today. You can still eat **${Math.round(remainingCals)} kcal** to stay on track for your goal! 🍎` });
    }

    // 3. Water / Fasting Keywords
    if (query.includes('water') || query.includes('drink') || query.includes('fasting') || query.includes('fast')) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const log = await prisma.dailyLog.findUnique({
        where: { userId_date: { userId, date: today } }
      });
      
      const glasses = log?.waterGlasses || 0;
      let reply = `You've drunk **${glasses}/8** glasses of water today. 💧 `;
      
      if (log?.fastingStartTime && !log?.fastingEndTime) {
         reply += "You are currently fasting. Stay strong! ⏳";
      } else {
         reply += "You are not fasting right now.";
      }
      
      return res.json({ reply });
    }

    // 4. Motivation / General
    if (query.includes('hi') || query.includes('hello') || query.includes('hey')) {
      return res.json({ reply: `Hello there! 👋 I am your SmartAssistant. Ask me about your **budget**, **calories**, or **water intake**!` });
    }

    if (query.includes('streak') || query.includes('habit')) {
      return res.json({ reply: `You are on a **${profile.currentStreak}-day streak**! 🔥 Your longest streak ever is ${profile.longestStreak}. Don't break the chain!` });
    }

    // Fallback
    return res.json({ reply: "I'm not sure how to answer that yet. Try asking me: 'How much budget is left?' or 'How many calories can I eat?' 🤖" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: "Oops! My circuits got tangled. Please try again later." });
  }
});

module.exports = router;
