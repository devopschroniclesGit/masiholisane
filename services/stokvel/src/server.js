const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const { connect: connectRabbitMQ } = require('../../../shared/config/rabbitmq');
const logger   = require('../../../shared/config/logger');
const { errorHandler } = require('../../../shared/middleware/errorHandler');
const { apiLimiter }   = require('../../../shared/middleware/rateLimiter');
const { sendSuccess }  = require('../../../shared/utils/response');

const poolRoutes    = require('./routes/pool.routes');
const stokvelRoutes = require('./routes/stokvel.routes');
const cycleRoutes   = require('./routes/cycle.routes');
const adminRoutes   = require('./routes/admin.routes');
const authRoutes    = require('./routes/auth.routes');
const cycleJob      = require('./jobs/cycle.job');

const app  = express();
const PORT = process.env.PORT || 3005;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/api/', apiLimiter);

app.get('/api/v1/health', (req, res) => {
  sendSuccess(res, {
    service: 'stokvel-service',
    status: 'healthy',
    uptime: process.uptime(),
  });
});

app.use('/api/v1/stokvels', poolRoutes);
app.use('/api/v1/stokvels', stokvelRoutes);
app.use('/api/v1/stokvels', cycleRoutes);
app.use('/api/v1/stokvels/admin', adminRoutes);
app.use('/api/v1/auth', authRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

app.use(errorHandler);

async function start() {
  try {
    await connectRabbitMQ();
    cycleJob.start();
    app.listen(PORT, () => {
      logger.info(`stokvel-service running on port ${PORT}`);
      logger.info(`Health: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (err) {
    logger.error('Failed to start stokvel-service: ' + err.message);
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
