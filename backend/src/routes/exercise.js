const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all exercise types
router.get('/types', authenticateToken, async (req, res) => {
  try {
    const exercises = await prisma.exercise.findMany();
    res.json(exercises);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch exercises' });
  }
});

// Log Exercise Entry
router.post('/', authenticateToken, async (req, res) => {
  const { exerciseId, durationMin, date } = req.body;
  try {
    const entry = await prisma.exerciseEntry.create({
      data: { 
        userId: req.user.userId, 
        exerciseId, 
        durationMin: parseInt(durationMin), 
        date: new Date(date) 
      },
      include: { exercise: true }
    });
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to log exercise' });
  }
});

module.exports = router;
