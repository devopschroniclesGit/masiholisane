const jwt     = require('jsonwebtoken');
const prisma  = require('../config/database');
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

// Gates financial actions (join pool, withdraw) behind SA ID verification.
// Must run after `authenticate`. Checks the live DB value rather than the
// JWT payload, since verification status can change mid-session.
async function requireIdVerified(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.id },
      select: { verified: true },
    });
    if (!user?.verified) {
      return sendError(res, 403, 'Verify your ID to continue. Go to your profile to verify.', {
        requiresIdVerification: true,
      });
    }
    next();
  } catch (err) { next(err); }
}

module.exports = { authenticate, requireAdmin, requireIdVerified };
