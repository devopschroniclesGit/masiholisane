const winston = require('winston');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  const service = process.env.SERVICE_NAME || 'masiholisane';
  return `${timestamp} [${service}] ${level}: ${stack || message}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'HH:mm:ss' }),
    colorize(),
    logFormat
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
