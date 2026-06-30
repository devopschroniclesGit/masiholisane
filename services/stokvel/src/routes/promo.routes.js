const express = require('express');
const router  = express.Router();
const prisma  = require('../../../../shared/config/database');
const { authenticate } = require('../../../../shared/middleware/auth');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');

// POST /promos/redeem — user redeems a code
router.post('/redeem', authenticate, async (req, res, next) => {
  try {
    const { code } = req.body;
    const userId   = req.user.id;

    if (!code) return sendError(res, 400, 'Code required');

    const promo = await prisma.promoCode.findUnique({
      where:   { code: code.toUpperCase().trim() },
      include: { redemptions: { where: { userId } } },
    });

    if (!promo)         return sendError(res, 404, 'Invalid code');
    if (!promo.active)  return sendError(res, 400, 'Code no longer active');
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return sendError(res, 400, 'Code has expired');
    }
    if (promo.usedCount >= promo.maxUses) {
      return sendError(res, 400, 'Code has reached maximum uses');
    }
    if (promo.redemptions.length > 0) {
      return sendError(res, 400, 'You have already redeemed this code');
    }

    const account = await prisma.account.findUnique({ where: { userId } });
    if (!account) return sendError(res, 404, 'Wallet not found');

    await prisma.$transaction(async (tx) => {
      await tx.promoCode.update({
        where: { id: promo.id },
        data:  { usedCount: { increment: 1 } },
      });

      await tx.promoCodeRedemption.create({
        data: {
          promoCodeId: promo.id,
          userId,
          amount:      promo.amount,
        },
      });

      await tx.account.update({
        where: { userId },
        data:  { bonusBalance: { increment: promo.amount } },
      });

      await tx.transaction.create({
        data: {
          toAccountId:    account.id,
          amount:         promo.amount,
          type:           'bonus',
          status:         'completed',
          idempotencyKey: `promo-${promo.id}-${userId}`,
          description:    `Promo code "${promo.code}" redeemed`,
        },
      });
    });

    return sendSuccess(res, {
      amount:    promo.amount,
      formatted: `R${(promo.amount / 100).toFixed(2)}`,
    }, `R${(promo.amount / 100).toFixed(2)} added to your VAS balance`);
  } catch (err) { next(err); }
});

module.exports = router;
