const express  = require('express');
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const prisma   = require('../../../../shared/config/database');
const logger   = require('../../../../shared/config/logger');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');
const { authenticate } = require('../../../../shared/middleware/auth');
const { uploadIdDocument } = require('../config/upload');

const router = express.Router();

const OTP_TTL_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const WELCOME_BONUS = 5000; // R50 in cents — credited to bonusBalance once phone is verified
const isDev = process.env.NODE_ENV !== 'production';

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[\s-]/g, '');
  if (/^\+27[6-8][0-9]{8}$/.test(digits)) return digits;
  if (/^0[6-8][0-9]{8}$/.test(digits)) return '+27' + digits.slice(1);
  return null;
}

function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

function tierFromScore(score) {
  if (score >= 90) return 'elite';
  if (score >= 70) return 'good';
  if (score >= 50) return 'trusted';
  if (score >= 30) return 'new';
  return 'restricted';
}

// Server-side mirror of the Luhn check already used in Register.jsx.
// Never trust client-side validation alone for something that unlocks money movement.
function validateSAID(id) {
  const cleaned = String(id || '').replace(/\s/g, '');
  if (!/^\d{13}$/.test(cleaned)) return { valid: false, message: 'Must be exactly 13 digits' };
  const month = parseInt(cleaned.slice(2, 4));
  const day   = parseInt(cleaned.slice(4, 6));
  if (month < 1 || month > 12) return { valid: false, message: 'Invalid birth month' };
  if (day < 1 || day > 31)     return { valid: false, message: 'Invalid birth day' };
  const citizenship = parseInt(cleaned[10]);
  if (citizenship !== 0 && citizenship !== 1) return { valid: false, message: 'Invalid ID format' };
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    let digit = parseInt(cleaned[i]);
    if (i % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  const check = (10 - (sum % 10)) % 10;
  if (check !== parseInt(cleaned[12])) return { valid: false, message: 'ID number is invalid, please check and try again' };
  const year     = parseInt(cleaned.slice(0, 2));
  const fullYear = year <= 25 ? 2000 + year : 1900 + year;
  const age      = new Date().getFullYear() - fullYear;
  if (age < 18)  return { valid: false, message: 'You must be 18 or older to register' };
  if (age > 100) return { valid: false, message: 'Please check your ID number' };
  return { valid: true, age };
}

async function issueOtp(phone) {
  // Invalidate any previous unconsumed codes for this phone+purpose
  await prisma.otpCode.updateMany({
    where:  { phone, purpose: 'registration', consumed: false },
    data:   { consumed: true },
  });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: { phone, code, purpose: 'registration', expiresAt },
  });

  // TODO: replace with real Twilio/WhatsApp send once signed up.
  // For now this is a stub — dev mode returns the code directly in the API response.
  logger.info(`[OTP STUB] ${phone} → ${code} (expires in ${OTP_TTL_MINUTES}m)`);

  return code;
}

// ── Register ─────────────────────────────────────────────────────────────────
// Phone + name + password only. No ID required at this step — ID verification
// is deferred until after login and gates deposits/joining, not signup itself.
router.post('/register', async (req, res, next) => {
  try {
    const { name, phone: rawPhone, password } = req.body;

    if (!name || !rawPhone || !password) {
      return sendError(res, 400, 'Name, phone number and password are required');
    }
    if (password.length < 8) {
      return sendError(res, 400, 'Password must be at least 8 characters');
    }

    const phone = normalizePhone(rawPhone);
    if (!phone) {
      return sendError(res, 400, 'Enter a valid SA mobile number, e.g. 082 123 4567');
    }

    let user = await prisma.user.findUnique({ where: { phone } });

    if (user?.phoneVerified) {
      return sendError(res, 409, 'This phone number is already registered. Please log in instead.');
    }

    const hash = await bcrypt.hash(password, 12);

    if (user) {
      // Unverified account exists (abandoned a previous signup) — update and resend.
      user = await prisma.user.update({
        where: { id: user.id },
        data:  { name, password: hash },
      });
    } else {
      user = await prisma.user.create({
        data: { name, phone, password: hash },
      });
      await prisma.account.create({ data: { userId: user.id } });
    }

    const code = await issueOtp(phone);

    return sendSuccess(res, {
      phone,
      ...(isDev && { devOtp: code }), // never sent in production — dev stub only
    }, 'Registration started. Enter the code sent to your phone.', 201);

  } catch (err) { next(err); }
});

// ── Verify OTP ───────────────────────────────────────────────────────────────
// Confirms the registration code, marks phone verified, credits the welcome
// bonus (bonus balance only, never withdrawable), and logs the user in.
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { phone: rawPhone, code } = req.body;
    const phone = normalizePhone(rawPhone);
    if (!phone || !code) return sendError(res, 400, 'Phone and code are required');

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return sendError(res, 404, 'No registration found for this phone number');
    if (user.phoneVerified) return sendError(res, 409, 'This phone number is already verified. Please log in.');

    const otp = await prisma.otpCode.findFirst({
      where:   { phone, purpose: 'registration', consumed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      return sendError(res, 400, 'Code expired. Request a new one.');
    }
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
      return sendError(res, 429, 'Too many incorrect attempts. Request a new code.');
    }
    if (otp.code !== String(code)) {
      await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      return sendError(res, 400, 'Incorrect code. Please try again.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
      await tx.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
      await tx.account.update({
        where: { userId: user.id },
        data:  { bonusBalance: { increment: WELCOME_BONUS } },
      });
      const account = await tx.account.findUnique({ where: { userId: user.id } });
      await tx.transaction.create({
        data: {
          toAccountId:    account.id,
          amount:         WELCOME_BONUS,
          type:           'bonus',
          status:         'completed',
          idempotencyKey: `welcome-bonus-${user.id}`,
          description:    'Welcome bonus (Buy credit only)',
        },
      });
    });

    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: 'member' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    return sendSuccess(res, {
      token,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email },
    }, 'Phone verified. Welcome to Masiholisane!');

  } catch (err) { next(err); }
});

// ── Resend OTP ───────────────────────────────────────────────────────────────
router.post('/resend-otp', async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone) return sendError(res, 400, 'Valid phone number required');

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return sendError(res, 404, 'No registration found for this phone number');
    if (user.phoneVerified) return sendError(res, 409, 'This phone number is already verified. Please log in.');

    const code = await issueOtp(phone);
    return sendSuccess(res, {
      phone,
      ...(isDev && { devOtp: code }),
    }, 'New code sent.');
  } catch (err) { next(err); }
});

// ── Login ────────────────────────────────────────────────────────────────────
// Accepts phone OR email as the identifier so existing email-based seed/admin
// accounts keep working alongside new phone-first signups.
router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return sendError(res, 400, 'Phone/email and password required');
    }

    const phone = normalizePhone(identifier);
    const user = await prisma.user.findFirst({
      where: phone ? { OR: [{ phone }, { email: identifier }] } : { email: identifier },
    });
    if (!user) return sendError(res, 401, 'Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return sendError(res, 401, 'Invalid credentials');

    if (!user.phoneVerified) {
      return sendError(res, 403, 'Please verify your phone number to continue.', {
        requiresOtp: true,
        phone: user.phone,
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: 'member' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    return sendSuccess(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
    }, 'Login successful');
  } catch (err) { next(err); }
});

// ── Verify ID (deferred KYC step) ───────────────────────────────────────────
// Called after login, any time. Gates joining pools and withdrawals — see
// requireIdVerified middleware. Awards +10 Trust Score on first verification.
// ── Submit ID for review (deferred KYC step) ────────────────────────────────
// Called after login, any time. Takes the ID number plus a photo of the
// document (multipart/form-data, field name "idDocument"). Does NOT grant
// `verified` immediately — that only happens once an admin approves it via
// the admin dashboard. See requireIdVerified middleware for what this gates.
router.post('/verify-id', authenticate, uploadIdDocument.single('idDocument'), async (req, res, next) => {
  try {
    const { idNumber } = req.body;
    const check = validateSAID(idNumber);
    if (!check.valid) return sendError(res, 400, check.message);

    if (!req.file) {
      return sendError(res, 400, 'Please upload a photo of your ID document');
    }

    const cleaned = String(idNumber).replace(/\s/g, '');

    const existing = await prisma.user.findUnique({ where: { idNumber: cleaned } });
    if (existing && existing.id !== req.user.id) {
      return sendError(res, 409, 'This ID number is already registered to another account');
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.verified) {
      return sendError(res, 409, 'Your ID is already verified');
    }
    if (user.idVerificationStatus === 'pending') {
      return sendError(res, 409, 'Your ID is already submitted and awaiting review');
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        idNumber:             cleaned,
        idDocumentPath:        req.file.filename,
        idVerificationStatus: 'pending',
        idSubmittedAt:        new Date(),
        idRejectionReason:    null,
      },
    });

    return sendSuccess(res, { status: 'pending' }, 'Submitted for review. We will confirm within 24-48 hours.');
  } catch (err) { next(err); }
});

// ── Current user ─────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.id },
      select: { id: true, name: true, email: true, phone: true, phoneVerified: true, verified: true, idVerificationStatus: true, idRejectionReason: true, deletionRequestedAt: true, createdAt: true },
    });
    const trust = await prisma.trustScore.findUnique({ where: { userId: req.user.id } });
    return res.json({
      success: true,
      data: {
        ...user,
        trustScore: trust?.score || 0,
        trustTier:  trust?.tier  || 'restricted',
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;

// ── Trust score history ──────────────────────────────────────────────────────
// Read-only audit trail of every score change for the current user — powers
// the "Why is my Trust Score what it is?" screen.
router.get('/trust-history', authenticate, async (req, res, next) => {
  try {
    const trust = await prisma.trustScore.findUnique({ where: { userId: req.user.id } });
    const events = await prisma.trustScoreEvent.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return sendSuccess(res, {
      currentScore: trust?.score || 0,
      currentTier:  trust?.tier  || 'restricted',
      events,
    });
  } catch (err) { next(err); }
});

// ── Request account deletion ────────────────────────────────────────────────
// Does NOT delete anything. Members can have live money obligations (owed
// contributions, pending payouts, escrow funds), so deletion is a manual,
// reviewed admin action — this just timestamps the request and confirms it
// to the member. See GET /admin/dashboard/deletion-requests for the queue.
router.post('/request-deletion', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.deletionRequestedAt) {
      return sendSuccess(res, { requestedAt: user.deletionRequestedAt }, 'You already have a pending deletion request.');
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data:  { deletionRequestedAt: new Date() },
    });

    return sendSuccess(res, { requestedAt: new Date() }, 'Your request has been received. We will review and confirm within a few business days.');
  } catch (err) { next(err); }
});
