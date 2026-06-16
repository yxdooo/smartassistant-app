const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

function calculateCalorieGoals(profile) {
  const { weightKg, heightCm, age, gender, activityLevel, weightGoal } = profile;

  let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
  bmr = gender === 'MALE' ? bmr + 5 : bmr - 161;

  const activityMultipliers = {
    SEDENTARY: 1.2,
    LIGHTLY_ACTIVE: 1.375,
    MODERATELY_ACTIVE: 1.55,
    VERY_ACTIVE: 1.725,
    EXTRA_ACTIVE: 1.9
  };

  const tdee = bmr * (activityMultipliers[activityLevel] || 1.2);

  let dailyCalorieGoal = tdee;
  if (weightGoal === 'LOSE_WEIGHT') {
    dailyCalorieGoal -= 500;
  } else if (weightGoal === 'GAIN_WEIGHT') {
    dailyCalorieGoal += 500;
  }

  return { bmr: Math.round(bmr), tdee: Math.round(tdee), dailyCalorieGoal: Math.round(dailyCalorieGoal) };
}

// Get all food items
router.get('/items', authenticateToken, async (req, res) => {
  try {
    const items = await prisma.foodItem.findMany();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch food items' });
  }
});

// Add Food Item (Global or Custom)
router.post('/items', authenticateToken, async (req, res) => {
  const { name, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g } = req.body;
  try {
    const item = await prisma.foodItem.create({
      data: { name, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, isCustom: true, createdByUserId: req.user.userId }
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add food item' });
  }
});

// Log Food Entry
router.post('/', authenticateToken, async (req, res) => {
  const { foodItemId, amountGrams, mealType, date } = req.body;
  try {
    const entry = await prisma.foodEntry.create({
      data: { userId: req.user.userId, foodItemId, amountGrams: parseFloat(amountGrams), mealType, date: new Date(date) },
      include: { foodItem: true }
    });
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to log food' });
  }
});

// Search External API (Open Food Facts)
router.get('/search-external', authenticateToken, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  
  try {
    // Requires Node 18+ for native fetch
    const response = await global.fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=10`);
    const data = await response.json();
    
    const results = (data.products || []).map(p => ({
      name: p.product_name,
      brand: p.brands,
      caloriesPer100g: p.nutriments?.['energy-kcal_100g'] || 0,
      proteinPer100g: p.nutriments?.['proteins_100g'] || 0,
      carbsPer100g: p.nutriments?.['carbohydrates_100g'] || 0,
      fatPer100g: p.nutriments?.['fat_100g'] || 0,
    })).filter(p => p.name && p.caloriesPer100g > 0);

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch from external API' });
  }
});

// Daily Summary & Insights
router.get('/summary', authenticateToken, async (req, res) => {
  const dateParam = req.query.date ? new Date(req.query.date) : new Date();
  const startOfDay = new Date(dateParam.setHours(0,0,0,0));
  const endOfDay = new Date(dateParam.setHours(23,59,59,999));

  try {
    const profile = await prisma.userProfile.findUnique({ where: { userId: req.user.userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const goals = calculateCalorieGoals(profile);

    const [entries, exercises] = await Promise.all([
      prisma.foodEntry.findMany({
        where: { userId: req.user.userId, date: { gte: startOfDay, lte: endOfDay } },
        include: { foodItem: true }
      }),
      prisma.exerciseEntry.findMany({
        where: { userId: req.user.userId, date: { gte: startOfDay, lte: endOfDay } },
        include: { exercise: true }
      })
    ]);

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    entries.forEach(entry => {
      const multiplier = entry.amountGrams / 100;
      totalCalories += entry.foodItem.caloriesPer100g * multiplier;
      totalProtein += entry.foodItem.proteinPer100g * multiplier;
      totalCarbs += entry.foodItem.carbsPer100g * multiplier;
      totalFat += entry.foodItem.fatPer100g * multiplier;
    });

    let burnedCalories = 0;
    exercises.forEach(entry => {
      burnedCalories += entry.durationMin * entry.exercise.caloriesBurnedPerMin;
    });

    const netCalories = totalCalories - burnedCalories;
    const targetProtein = profile.weightKg * 2; 

    let insightMessage = "You are doing great!";
    if (totalProtein < targetProtein) {
      insightMessage = `To hit your protein target today, you need ${Math.round(targetProtein - totalProtein)}g more protein.`;
    }

    res.json({
      goals,
      consumed: {
        calories: Math.round(totalCalories),
        protein: Math.round(totalProtein),
        carbs: Math.round(totalCarbs),
        fat: Math.round(totalFat)
      },
      burnedCalories: Math.round(burnedCalories),
      netCalories: Math.round(netCalories),
      insightMessage,
      entries,
      exercises
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

module.exports = router;
