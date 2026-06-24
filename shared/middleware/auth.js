const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');

function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'No token provided');
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.userId, email: decoded.email, role: decoded.role || 'member' };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return sendError(res, 401, 'Token expired');
    if (err.name === 'JsonWebTokenError') return sendError(res, 401, 'Invalid token');
    return sendError(res, 401, 'Authentication failed');
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return sendError(res, 403, 'Admin access required');
  next();
}

module.exports = { authenticate, requireAdmin };
