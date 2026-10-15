require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authenticateToken = require('./middleware/auth');
const activityLogger = require('./middleware/activityLogger');

const authRoutes = require('./routes/auth');
const budgetRoutes = require('./routes/budget');
const calorieRoutes = require('./routes/calorie');
const exerciseRoutes = require('./routes/exercise');
const subscriptionRoutes = require('./routes/subscription');
const trackerRoutes = require('./routes/tracker');
const aiRoutes = require('./routes/ai');
const analyticsRoutes = require('./routes/analytics');
const communityRoutes = require('./routes/community');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Public routes (Auth & Health)
app.use('/api/auth', authRoutes);
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Smart Assistant Backend is running.' });
});

// Protected routes router
const protectedRouter = express.Router();
protectedRouter.use(authenticateToken);
protectedRouter.use(activityLogger);

protectedRouter.use('/budget', budgetRoutes);
protectedRouter.use('/calorie', calorieRoutes);
protectedRouter.use('/exercise', exerciseRoutes);
protectedRouter.use('/subscription', subscriptionRoutes);
protectedRouter.use('/tracker', trackerRoutes);
protectedRouter.use('/ai', aiRoutes);
protectedRouter.use('/analytics', analyticsRoutes);
protectedRouter.use('/community', communityRoutes);

app.use('/api', protectedRouter);

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
