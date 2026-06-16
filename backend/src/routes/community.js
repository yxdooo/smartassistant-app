const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get the top 50 users based on their current streak
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const topProfiles = await prisma.userProfile.findMany({
      orderBy: { currentStreak: 'desc' },
      take: 50,
      select: {
        id: true,
        currentStreak: true,
        longestStreak: true,
        user: {
          select: { email: true } // In a real app we'd use usernames to protect emails, but for now we'll mask it
        }
      }
    });

    // Mask emails for privacy (e.g. j***@gmail.com)
    const leaderboard = topProfiles.map((p, index) => {
      const emailParts = p.user.email.split('@');
      const maskedEmail = emailParts[0].charAt(0) + '***@' + emailParts[1];
      
      return {
        rank: index + 1,
        id: p.id,
        username: maskedEmail,
        currentStreak: p.currentStreak,
        longestStreak: p.longestStreak
      };
    });

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
