const logger = require('../config/logger');
const { sendError } = require('../utils/response');

function errorHandler(err, req, res, next) {
  logger.error(err.message);
  if (err.code === 'P2002') return sendError(res, 409, 'Record already exists');
  if (err.code === 'P2025') return sendError(res, 404, 'Record not found');
  if (err.statusCode) return sendError(res, err.statusCode, err.message);
  return sendError(res, 500, process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message);
}

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

module.exports = { errorHandler, AppError };
