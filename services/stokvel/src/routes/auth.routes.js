const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const prisma   = require('../../../../shared/config/database');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');

const router = express.Router();

// TEMPORARY — for local testing only
// Remove before production
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 400, 'Email and password required');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return sendError(res, 401, 'Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return sendError(res, 401, 'Invalid credentials');

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: 'member' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    return sendSuccess(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email },
    }, 'Login successful');
  } catch (err) { next(err); }
});

module.exports = router;
