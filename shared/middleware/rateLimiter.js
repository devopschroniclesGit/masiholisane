const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      isDev ? 10000 : 100,
  message:  { success: false, message: 'Too many requests' },
  validate: { keyGeneratorIpFallback: false },
});

const financialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      isDev ? 10000 : 20,
  message:  { success: false, message: 'Too many financial requests' },
  validate: { keyGeneratorIpFallback: false },
});

const joinLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      isDev ? 10000 : 5,
  message:  { success: false, message: 'Too many join attempts' },
  validate: { keyGeneratorIpFallback: false },
});

module.exports = { apiLimiter, financialLimiter, joinLimiter };
