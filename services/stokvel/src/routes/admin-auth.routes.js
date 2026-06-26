const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const prisma  = require('../../../../shared/config/database');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return sendError(res, 400, 'Email and password required');

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) return sendError(res, 401, 'Invalid credentials');

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return sendError(res, 401, 'Invalid credentials');

    const token = jwt.sign(
      { adminId: admin.id, email: admin.email, role: admin.role, isAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return sendSuccess(res, {
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    }, 'Admin login successful');
  } catch (err) { next(err); }
});

router.get('/me', requireAdmin, async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUnique({
      where:  { id: req.admin.adminId },
      select: { id: true, name: true, email: true, role: true },
    });
    return sendSuccess(res, { admin });
  } catch (err) { next(err); }
});

function requireAdmin(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return sendError(res, 401, 'Admin token required');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isAdmin) return sendError(res, 403, 'Admin access required');
    req.admin = decoded;
    next();
  } catch {
    return sendError(res, 401, 'Invalid admin token');
  }
}

module.exports = { router, requireAdmin };
