const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const subs = await prisma.subscription.findMany({
      where: { userId: req.user.userId, isActive: true },
      orderBy: { nextBillingDate: 'asc' }
    });
    res.json(subs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

router.post('/', async (req, res) => {
  const { name, amount, billingCycle, nextBillingDate } = req.body;
  try {
    const sub = await prisma.subscription.create({
      data: {
        userId: req.user.userId,
        name,
        amount: parseFloat(amount),
        billingCycle,
        nextBillingDate: new Date(nextBillingDate)
      }
    });
    res.status(201).json(sub);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add subscription' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.subscription.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;
