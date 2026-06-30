require('dotenv').config();
const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const { connect: connectRabbitMQ } = require('../../../shared/config/rabbitmq');
const logger   = require('../../../shared/config/logger');
const { errorHandler } = require('../../../shared/middleware/errorHandler');
const { apiLimiter }   = require('../../../shared/middleware/rateLimiter');
const { sendSuccess }  = require('../../../shared/utils/response');

const poolRoutes    = require('./routes/pool.routes');
const promoRoutes   = require('./routes/promo.routes');
const vasRoutes     = require('./routes/vas.routes');
const stokvelRoutes = require('./routes/stokvel.routes');
const cycleRoutes   = require('./routes/cycle.routes');
const adminRoutes   = require('./routes/admin.routes');
const authRoutes    = require('./routes/auth.routes');
const walletRoutes      = require('./routes/wallet.routes');
const { router: adminAuthRoutes } = require('./routes/admin-auth.routes');
const adminDashRoutes = require('./routes/admin-dashboard.routes');
const cycleJob      = require('./jobs/cycle.job');

const app  = express();
const PORT = process.env.PORT || 3005;

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/api/', apiLimiter);

app.get('/api/v1/health', (req, res) => {
  sendSuccess(res, {
    service: 'stokvel-service',
    status:  'healthy',
    uptime:  process.uptime(),
  });
});

app.use('/api/v1/auth',             authRoutes);
app.use('/api/v1/wallet',           walletRoutes);
app.use('/api/v1/promos',   promoRoutes);
app.use('/api/v1/vas',      vasRoutes);
app.use('/api/v1/admin/auth',       adminAuthRoutes);
app.use('/api/v1/admin/dashboard',  adminDashRoutes);
app.use('/api/v1/stokvels',         poolRoutes);
app.use('/api/v1/stokvels',         stokvelRoutes);
app.use('/api/v1/stokvels',         cycleRoutes);
app.use('/api/v1/stokvels/admin',   adminRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

app.use(errorHandler);

async function start() {
  try {
    await connectRabbitMQ();
    cycleJob.start();
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`stokvel-service running on port ${PORT}`);
      logger.info(`Health: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (err) {
    logger.error('Failed to start: ' + err.message);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  logger.info('Shutting down...');
  cycleJob.stop();
  process.exit(0);
});

start();
module.exports = app;
