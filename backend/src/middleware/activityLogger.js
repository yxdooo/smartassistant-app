const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const activityLogger = async (req, res, next) => {
  // We only hook onto the finish event to not block the response
  res.on('finish', async () => {
    if (req.method === 'POST' && res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      try {
        const userId = req.user.userId;
        const profile = await prisma.userProfile.findUnique({ where: { userId } });
        if (!profile) return;

        const today = new Date();
        today.setHours(0,0,0,0);
        
        let { currentStreak, longestStreak, lastActiveDate } = profile;

        if (!lastActiveDate) {
          currentStreak = 1;
        } else {
          const lastActive = new Date(lastActiveDate);
          lastActive.setHours(0,0,0,0);
          
          const diffTime = today.getTime() - lastActive.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
             currentStreak += 1;
          } else if (diffDays > 1) {
             currentStreak = 1;
          }
        }

        if (currentStreak > longestStreak) {
           longestStreak = currentStreak;
        }

        // Only update if something changed
        if (!lastActiveDate || today.getTime() > new Date(lastActiveDate).setHours(0,0,0,0)) {
           await prisma.userProfile.update({
             where: { userId },
             data: { currentStreak, longestStreak, lastActiveDate: new Date() }
           });
        }
      } catch (err) {
        console.error('Activity Logger Error:', err);
      }
    }
  });
  next();
};

module.exports = activityLogger;
