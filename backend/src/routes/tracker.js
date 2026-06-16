const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

const getTodayLog = async (userId) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  
  let log = await prisma.dailyLog.findUnique({
    where: { userId_date: { userId, date: today } }
  });

  if (!log) {
    log = await prisma.dailyLog.create({
      data: { userId, date: today }
    });
  }
  return log;
};

router.get('/daily', async (req, res) => {
  try {
    const log = await getTodayLog(req.user.userId);
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily log' });
  }
});

router.post('/water', async (req, res) => {
  const { glasses } = req.body;
  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    const log = await prisma.dailyLog.upsert({
      where: { userId_date: { userId: req.user.userId, date: today } },
      update: { waterGlasses: glasses },
      create: { userId: req.user.userId, date: today, waterGlasses: glasses }
    });
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update water' });
  }
});

router.post('/fasting', async (req, res) => {
  const { action } = req.body; // 'start' or 'stop'
  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    const updateData = action === 'start' 
      ? { fastingStartTime: new Date(), fastingEndTime: null }
      : { fastingEndTime: new Date() };
      
    const log = await prisma.dailyLog.upsert({
      where: { userId_date: { userId: req.user.userId, date: today } },
      update: updateData,
      create: { userId: req.user.userId, date: today, ...updateData }
    });
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update fasting' });
  }
});

module.exports = router;
