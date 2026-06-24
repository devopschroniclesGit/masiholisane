const cron   = require('node-cron');
const logger = require('../../../../shared/config/logger');

let warningJob = null;

function start() {
  warningJob = cron.schedule('0 8 * * *', () => {
    logger.info('CRON: Daily cycle check running...');
  }, { timezone: 'Africa/Johannesburg' });

  logger.info('Cycle cron jobs started');
}

function stop() {
  warningJob?.stop();
  logger.info('Cycle cron jobs stopped');
}

module.exports = { start, stop };
