const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Assembles a comprehensive real-time context payload for the user.
 * This is fed into LLMs or the deterministic fallback engine.
 */
async function assembleUserContext(userId) {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 1. Budget & Expenses
  const expenses = await prisma.expense.findMany({
    where: { userId, date: { gte: startOfMonth } },
    include: { category: true }
  });
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remainingBudget = profile.monthlyBudgetLimit - totalSpent;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - now.getDate() + 1);
  const dailyAllowance = Math.max(0, remainingBudget / daysRemaining);

  // Group expenses by category
  const categoryTotals = {};
  for (const exp of expenses) {
    const catName = exp.category?.name || 'Uncategorized';
    categoryTotals[catName] = (categoryTotals[catName] || 0) + exp.amount;
  }
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amt]) => `${cat}: $${amt.toFixed(2)}`);

  // Subscriptions
  const subscriptions = await prisma.subscription.findMany({
    where: { userId, isActive: true }
  });
  const monthlySubscriptionCost = subscriptions.reduce((sum, s) => {
    return sum + (s.billingCycle === 'YEARLY' ? s.amount / 12 : s.amount);
  }, 0);

  // 2. Nutrition & Calories
  const foodLogs = await prisma.foodEntry.findMany({
    where: { userId, date: { gte: today } },
    include: { foodItem: true }
  });
  let consumedCalories = 0;
  let consumedProtein = 0;
  let consumedCarbs = 0;
  let consumedFat = 0;

  for (const log of foodLogs) {
    const factor = log.amountGrams / 100;
    consumedCalories += factor * (log.foodItem?.caloriesPer100g || 0);
    consumedProtein += factor * (log.foodItem?.proteinPer100g || 0);
    consumedCarbs += factor * (log.foodItem?.carbsPer100g || 0);
    consumedFat += factor * (log.foodItem?.fatPer100g || 0);
  }

  // TDEE & Macro target estimates (Mifflin-St Jeor)
  const s = profile.gender === 'MALE' ? 5 : -161;
  const bmr = (10 * profile.weightKg) + (6.25 * profile.heightCm) - (5 * profile.age) + s;
  const activityMultipliers = {
    SEDENTARY: 1.2,
    LIGHTLY_ACTIVE: 1.375,
    MODERATELY_ACTIVE: 1.55,
    VERY_ACTIVE: 1.725,
    EXTRA_ACTIVE: 1.9
  };
  let targetCalories = bmr * (activityMultipliers[profile.activityLevel] || 1.2);
  if (profile.weightGoal === 'LOSE_WEIGHT') targetCalories -= 500;
  if (profile.weightGoal === 'GAIN_WEIGHT') targetCalories += 500;

  const targetProteinGrams = Math.round(profile.weightKg * 1.8);
  const targetCarbsGrams = Math.round((targetCalories * 0.45) / 4);
  const targetFatGrams = Math.round((targetCalories * 0.25) / 9);

  // 3. Hydration & Fasting
  const dailyLog = await prisma.dailyLog.findUnique({
    where: { userId_date: { userId, date: today } }
  });
  const waterGlasses = dailyLog?.waterGlasses || 0;
  const isFasting = !!(dailyLog?.fastingStartTime && !dailyLog?.fastingEndTime);
  let fastingHoursElapsed = 0;
  if (isFasting) {
    fastingHoursElapsed = (now - new Date(dailyLog.fastingStartTime)) / (1000 * 60 * 60);
  }

  // 4. Exercises
  const exerciseEntries = await prisma.exerciseEntry.findMany({
    where: { userId, date: { gte: today } },
    include: { exercise: true }
  });
  let totalExerciseMinutes = 0;
  let totalCaloriesBurned = 0;
  for (const ex of exerciseEntries) {
    totalExerciseMinutes += ex.durationMin;
    totalCaloriesBurned += ex.durationMin * (ex.exercise?.caloriesBurnedPerMin || 5);
  }

  return {
    profile: {
      age: profile.age,
      gender: profile.gender,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      activityLevel: profile.activityLevel,
      weightGoal: profile.weightGoal,
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      monthlyBudgetLimit: profile.monthlyBudgetLimit,
      aiApiKey: profile.aiApiKey,
      aiProvider: profile.aiProvider || 'gemini'
    },
    budget: {
      monthlyLimit: profile.monthlyBudgetLimit,
      totalSpent: Math.round(totalSpent * 100) / 100,
      remaining: Math.round(remainingBudget * 100) / 100,
      daysRemaining,
      dailyAllowance: Math.round(dailyAllowance * 100) / 100,
      topCategories,
      activeSubscriptionsCount: subscriptions.length,
      monthlySubscriptionCost: Math.round(monthlySubscriptionCost * 100) / 100
    },
    nutrition: {
      consumedCalories: Math.round(consumedCalories),
      targetCalories: Math.round(targetCalories),
      remainingCalories: Math.max(0, Math.round(targetCalories - consumedCalories)),
      protein: { consumed: Math.round(consumedProtein), target: targetProteinGrams },
      carbs: { consumed: Math.round(consumedCarbs), target: targetCarbsGrams },
      fat: { consumed: Math.round(consumedFat), target: targetFatGrams },
      foodItemCount: foodLogs.length
    },
    hydration: {
      waterGlasses,
      targetGlasses: 8,
      liters: (waterGlasses * 0.25).toFixed(2)
    },
    fasting: {
      isFasting,
      startTime: dailyLog?.fastingStartTime,
      hoursElapsed: fastingHoursElapsed.toFixed(1),
      targetHours: 16
    },
    exercise: {
      minutesToday: totalExerciseMinutes,
      caloriesBurned: Math.round(totalCaloriesBurned)
    }
  };
}

/**
 * Enhanced deterministic SmartEngine providing structured markdown analysis.
 * Operates with zero API keys or external dependencies.
 */
function runDeterministicEngine(query, ctx) {
  const q = query.toLowerCase().trim();

  // 1. Daily Summary / Executive Briefing
  if (q.includes('summary') || q.includes('digest') || q.includes('recap') || q.includes('brief') || q.includes('today') || q.includes('overview')) {
    const b = ctx.budget;
    const n = ctx.nutrition;
    const h = ctx.hydration;
    const f = ctx.fasting;

    const budgetStatus = b.remaining >= 0
      ? `🟢 **$${b.remaining.toFixed(2)}** remaining ($${b.dailyAllowance.toFixed(2)}/day safe allowance).`
      : `🔴 **$${Math.abs(b.remaining).toFixed(2)}** over limit!`;

    const calStatus = n.consumedCalories <= n.targetCalories
      ? `🟢 **${n.consumedCalories} / ${n.targetCalories} kcal** consumed (${n.remainingCalories} kcal left).`
      : `⚠️ **${n.consumedCalories} / ${n.targetCalories} kcal** consumed (${n.consumedCalories - n.targetCalories} kcal over target).`;

    const fastingStatus = f.isFasting
      ? `Active (${f.hoursElapsed}h of 16h completed)`
      : `Inactive`;

    return `### 📋 Daily Executive Summary

**1. Financial Overview**
* Budget Limit: **$${b.monthlyLimit.toFixed(2)}**
* Month-to-date Spent: **$${b.totalSpent.toFixed(2)}**
* Status: ${budgetStatus}

**2. Nutrition & Energy**
* Caloric Intake: ${calStatus}
* Macros: **${n.protein.consumed}g** Protein, **${n.carbs.consumed}g** Carbs, **${n.fat.consumed}g** Fat
* Water Intake: **${h.waterGlasses} / ${h.targetGlasses}** glasses (${h.liters} L)

**3. Health & Routine**
* Fasting: **${fastingStatus}**
* Exercise: **${ctx.exercise.minutesToday} min** (${ctx.exercise.caloriesBurned} kcal burned)
* Consistency Streak: **${ctx.profile.currentStreak} days** 🔥

*Pro-tip: You can ask specific questions like "What should I eat next?" or "How's my budget pace?" anytime!*`;
  }

  // 2. Budget & Finance
  if (q.includes('budget') || q.includes('spend') || q.includes('money') || q.includes('expense') || q.includes('cost') || q.includes('runway') || q.includes('left')) {
    const b = ctx.budget;
    const pacingPercentage = Math.round((b.totalSpent / (b.monthlyLimit || 1)) * 100);

    let paceAdvice = '';
    if (pacingPercentage < 50) {
      paceAdvice = 'Excellent discipline! You are pacing well below your monthly ceiling.';
    } else if (pacingPercentage <= 85) {
      paceAdvice = 'On track, but monitor discretionary expenditures closely.';
    } else if (pacingPercentage <= 100) {
      paceAdvice = 'Approaching monthly limit. Stick to essential purchases only.';
    } else {
      paceAdvice = 'Budget exceeded! Recommend freezing non-essential spending until next month.';
    }

    const categoriesList = b.topCategories.length > 0
      ? b.topCategories.map(c => `  - ${c}`).join('\n')
      : '  - No expenses recorded yet this month.';

    return `### 💸 Financial & Budget Analysis

* **Monthly Cap:** $${b.monthlyLimit.toFixed(2)}
* **Total Spent:** $${b.totalSpent.toFixed(2)} (${pacingPercentage}% consumed)
* **Safe Daily Allowance:** **$${b.dailyAllowance.toFixed(2)} / day** across the next ${b.daysRemaining} days.
* **Top Expense Categories:**
${categoriesList}
* **Fixed Subscriptions:** ${b.activeSubscriptionsCount} active ($${b.monthlySubscriptionCost.toFixed(2)}/mo)

**Pacing Assessment:** ${paceAdvice}`;
  }

  // 3. Nutrition, Food & Macros
  if (q.includes('calorie') || q.includes('food') || q.includes('diet') || q.includes('eat') || q.includes('macro') || q.includes('protein') || q.includes('carb') || q.includes('fat') || q.includes('meal')) {
    const n = ctx.nutrition;
    const proteinPacing = Math.round((n.protein.consumed / (n.protein.target || 1)) * 100);

    return `### 🥗 Nutritional & Macronutrient Breakdown

* **Target Daily Intake:** ${n.targetCalories} kcal (${ctx.profile.weightGoal.replace('_', ' ')})
* **Consumed Today:** **${n.consumedCalories} kcal**
* **Remaining Budget:** **${n.remainingCalories} kcal**

**Macronutrient Status:**
* **Protein:** ${n.protein.consumed}g / ${n.protein.target}g (${proteinPacing}%)
* **Carbohydrates:** ${n.carbs.consumed}g / ${n.carbs.target}g
* **Fats:** ${n.fat.consumed}g / ${n.fat.target}g

**Dietary Recommendation:**
${n.remainingCalories > 300 
  ? `You have room for a nutritious meal. Prioritize lean protein (chicken breast, Greek yogurt, tofu, fish) to reach your ${n.protein.target}g goal.` 
  : `You are close to your caloric target for the day. If hungry, opt for fibrous vegetables or a light herbal tea.`}`;
  }

  // 4. Hydration & Water
  if (q.includes('water') || q.includes('drink') || q.includes('hydration')) {
    const h = ctx.hydration;
    const remainingGlasses = Math.max(0, h.targetGlasses - h.waterGlasses);

    return `### 💧 Hydration Tracker

* **Consumed Today:** **${h.waterGlasses} of ${h.targetGlasses} glasses** (~${h.liters} Liters).
* **Target Remaining:** ${remainingGlasses > 0 ? `${remainingGlasses} more glasses needed.` : 'Daily goal achieved! Great job maintaining cellular hydration.'}

*Tip: Drinking water 20 minutes before meals aids satiety and metabolic rate.*`;
  }

  // 5. Fasting
  if (q.includes('fast') || q.includes('fasting') || q.includes('intermittent')) {
    const f = ctx.fasting;
    if (f.isFasting) {
      const remainingHours = Math.max(0, f.targetHours - parseFloat(f.hoursElapsed));
      return `### ⏱️ Intermittent Fasting Status

* **State:** **Currently Fasting** ⏳
* **Elapsed Time:** **${f.hoursElapsed} hours**
* **Protocol:** 16:8 Fasting Window
* **Remaining to 16h Goal:** ${remainingHours > 0 ? `**${remainingHours.toFixed(1)} hours** to go. Stay hydrated with black coffee, green tea, or water!` : '🎉 **16-hour goal achieved!** You may break your fast with a balanced whole-food meal.'}`;
    } else {
      return `### ⏱️ Intermittent Fasting Status

* **State:** **Not currently fasting.**
* Start a fast anytime from the Dashboard to track your autophagy and fasting window!`;
    }
  }

  // 6. Streaks & Gamification
  if (q.includes('streak') || q.includes('habit') || q.includes('consistency') || q.includes('score') || q.includes('rank')) {
    return `### 🔥 Habit & Consistency Tracker

* **Current Active Streak:** **${ctx.profile.currentStreak} days**
* **Personal Record:** ${ctx.profile.longestStreak} days
* **Community Standings:** Track your position on the [Global Leaderboard](/community).

*Remember: Consistency outpaces perfection every single time. Keep the chain unbroken today!*`;
  }

  // 7. Greetings & Capabilities
  if (q.includes('hi') || q.includes('hello') || q.includes('hey') || q.includes('who are you') || q.includes('help')) {
    return `### 👋 Welcome to SmartAssistant!

I am your personal Life OS assistant. Here is what I can analyze for you:

1. **Daily Executive Digest:** Type *"summary"* for a 360° health & finance report.
2. **Budget Pacing:** Ask *"How's my budget?"* or *"What's my daily spending runway?"*
3. **Nutrition & Macros:** Ask *"What macros do I need today?"* or *"How many calories left?"*
4. **Hydration & Fasting:** Ask *"Water intake"* or *"Fasting status"*.

*(Tip: In Settings, you can plug in your free **Google Gemini** or **OpenAI** API key to unlock full conversational LLM capabilities with live context!)*`;
  }

  // Default Fallback
  return `### 🤖 SmartAssistant Response

I'm monitoring your financial and biometric pacing. Here is your quick status:
* **Budget Remaining:** $${ctx.budget.remaining.toFixed(2)} ($${ctx.budget.dailyAllowance.toFixed(2)}/day)
* **Calorie Budget:** ${ctx.nutrition.remainingCalories} kcal left out of ${ctx.nutrition.targetCalories} kcal
* **Hydration:** ${ctx.hydration.waterGlasses}/8 glasses

Try asking:
- *"Give me today's summary"*
- *"How is my budget pacing?"*
- *"Show my macro breakdown"*
- Or connect a personal Gemini / OpenAI key in **Settings** for open-ended conversation!`;
}

/**
 * Executes a call to Google Gemini using direct REST API.
 */
async function callGemini(apiKey, systemPrompt, userMessage) {
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      };

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${resp.status} ${resp.statusText}`);
      }

      const data = await resp.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) {
        return { reply, model };
      }
    } catch (err) {
      lastError = err;
      // Try next model if 404/model not found
    }
  }

  throw lastError || new Error('Failed to generate response from Gemini');
}

/**
 * Executes a call to OpenAI using direct REST API.
 */
async function callOpenAI(apiKey, systemPrompt, userMessage) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.7,
    max_tokens: 1000
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) throw new Error('Empty response from OpenAI');

  return { reply, model: 'gpt-4o-mini' };
}

// --- ROUTES ---

/**
 * POST /api/ai/validate-key
 * Validates a user-provided API key for Gemini or OpenAI.
 */
router.post('/validate-key', async (req, res) => {
  const { apiKey, provider } = req.body;
  if (!apiKey || !apiKey.trim()) {
    return res.status(400).json({ valid: false, error: 'API key is required.' });
  }

  const cleanKey = apiKey.trim();
  const targetProvider = (provider || 'gemini').toLowerCase();

  try {
    if (targetProvider === 'openai') {
      const testResp = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${cleanKey}` }
      });
      if (!testResp.ok) {
        const err = await testResp.json().catch(() => ({}));
        return res.status(400).json({ valid: false, error: err.error?.message || 'Invalid OpenAI API key.' });
      }
      return res.json({ valid: true, message: 'OpenAI API key verified successfully!' });
    } else {
      // Test Gemini key
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
      const testResp = await fetch(url);
      if (!testResp.ok) {
        const err = await testResp.json().catch(() => ({}));
        return res.status(400).json({ valid: false, error: err.error?.message || 'Invalid Gemini API key.' });
      }
      return res.json({ valid: true, message: 'Google Gemini API key verified successfully!' });
    }
  } catch (err) {
    return res.status(500).json({ valid: false, error: `Validation network error: ${err.message}` });
  }
});

/**
 * POST /api/ai/chat
 * Primary chat endpoint. Routes to LLM if user has configured an API key,
 * otherwise routes to the deterministic SmartEngine.
 */
router.post('/chat', async (req, res) => {
  const { message, customApiKey, customProvider } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ reply: 'Please provide a message or question.' });
  }

  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ reply: 'Unauthorized session.' });
  }

  try {
    const ctx = await assembleUserContext(userId);
    if (!ctx) {
      return res.status(404).json({ reply: 'Profile not found. Please complete initial setup in Settings.' });
    }

    const effectiveApiKey = customApiKey?.trim() || ctx.profile.aiApiKey;
    const effectiveProvider = (customProvider || ctx.profile.aiProvider || 'gemini').toLowerCase();

    // 1. If user provided a key, attempt LLM call
    if (effectiveApiKey) {
      const systemPrompt = `You are SmartAssistant, an elite, highly competent Personal Life OS AI assistant.
You have access to the user's real-time financial, nutritional, and biometric telemetry:

=== LIVE USER CONTEXT ===
- Profile: Age ${ctx.profile.age}, ${ctx.profile.gender}, Height ${ctx.profile.heightCm}cm, Weight ${ctx.profile.weightKg}kg
- Fitness Goal: ${ctx.profile.weightGoal.replace('_', ' ')}, Activity: ${ctx.profile.activityLevel}
- Consistency Streak: ${ctx.profile.currentStreak} days (Record: ${ctx.profile.longestStreak} days)

- Budget & Finances:
  * Monthly Budget Limit: $${ctx.budget.monthlyLimit.toFixed(2)}
  * Total Spent Month-to-Date: $${ctx.budget.totalSpent.toFixed(2)}
  * Remaining Budget: $${ctx.budget.remaining.toFixed(2)}
  * Safe Daily Allowance: $${ctx.budget.dailyAllowance.toFixed(2)}/day across ${ctx.budget.daysRemaining} days remaining
  * Top Categories: ${ctx.budget.topCategories.join(', ') || 'None recorded yet'}
  * Active Subscriptions: ${ctx.budget.activeSubscriptionsCount} ($${ctx.budget.monthlySubscriptionCost.toFixed(2)}/mo)

- Nutrition & Calories (Today):
  * Consumed: ${ctx.nutrition.consumedCalories} kcal of target ${ctx.nutrition.targetCalories} kcal (${ctx.nutrition.remainingCalories} kcal remaining)
  * Macros: Protein ${ctx.nutrition.protein.consumed}g / ${ctx.nutrition.protein.target}g target; Carbs ${ctx.nutrition.carbs.consumed}g / ${ctx.nutrition.carbs.target}g target; Fat ${ctx.nutrition.fat.consumed}g / ${ctx.nutrition.fat.target}g target

- Hydration & Fasting:
  * Water Intake: ${ctx.hydration.waterGlasses} of ${ctx.hydration.targetGlasses} glasses (${ctx.hydration.liters} L)
  * Fasting: ${ctx.fasting.isFasting ? `Active, ${ctx.fasting.hoursElapsed}h elapsed toward 16h target` : 'Inactive'}

=== INSTRUCTIONS ===
- Answer directly, concisely, and supportively in clean GitHub Markdown.
- Reference exact numbers from the context when relevant to provide precise, actionable value.
- Do NOT sound like generic AI hype or produce filler content. Speak like an objective, expert personal advisor.
- Keep tone professional, crisp, and motivating.`;

      try {
        let result;
        if (effectiveProvider === 'openai') {
          result = await callOpenAI(effectiveApiKey, systemPrompt, message);
        } else {
          result = await callGemini(effectiveApiKey, systemPrompt, message);
        }

        return res.json({
          reply: result.reply,
          source: 'llm',
          provider: effectiveProvider,
          model: result.model
        });
      } catch (llmErr) {
        console.warn(`[AI Engine] LLM call failed with provider ${effectiveProvider}:`, llmErr.message);
        // Fallback to deterministic algorithm with transparent notice
        const fallbackReply = runDeterministicEngine(message, ctx);
        return res.json({
          reply: `*(Note: Your custom ${effectiveProvider.toUpperCase()} key encountered an error: "${llmErr.message}". Serving via built-in SmartEngine.)*\n\n${fallbackReply}`,
          source: 'fallback',
          error: llmErr.message
        });
      }
    }

    // 2. No API Key configured -> Built-in deterministic SmartEngine
    const reply = runDeterministicEngine(message, ctx);
    return res.json({
      reply,
      source: 'smartengine',
      provider: 'built-in'
    });

  } catch (error) {
    console.error('[AI Engine Fatal Error]:', error);
    return res.status(500).json({
      reply: 'An unexpected error occurred while processing your request. Please try again shortly.',
      error: error.message
    });
  }
});

module.exports = router;
