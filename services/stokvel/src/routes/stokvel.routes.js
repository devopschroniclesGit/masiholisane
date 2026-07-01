const express = require('express');
const { authenticate } = require('../../../../shared/middleware/auth');
const { financialLimiter } = require('../../../../shared/middleware/rateLimiter');
const stokvelController = require('../controllers/stokvel.controller');
const prisma = require('../../../../shared/config/database');
const { getTierAmount } = require('../../../../shared/utils/money');

const router = express.Router();

router.get('/my', authenticate, stokvelController.getMyGroups);

// GET /stokvels/alerts
// Must be registered before /:groupId, otherwise Express matches "alerts"
// as a groupId param and this route never gets reached. Powers the
// login/dashboard banners: suspended or blacklisted memberships, and any
// upcoming cycle due within 5 days where the member's cash balance won't
// cover it. Mirrors the exact same window and balance check the daily cron
// job uses, so what the member sees here matches what will actually happen
// if they don't act. Bonus balance is deliberately excluded, contributions
// can only be funded from cash.
router.get('/alerts', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const flaggedMemberships = await prisma.stokvelMember.findMany({
      where: { userId, status: { in: ['suspended', 'blacklisted'] } },
      include: { group: true },
    });

    const suspended   = [];
    const blacklisted = [];
    for (const m of flaggedMemberships) {
      const entry = { groupId: m.groupId, tier: m.group.tier };
      if (m.status === 'suspended') suspended.push(entry);
      else blacklisted.push(entry);
    }

    const activeMemberships = await prisma.stokvelMember.findMany({
      where: { userId, status: 'active' },
      include: { group: { include: { cycles: { where: { status: 'collecting' } } } } },
    });

    const account     = await prisma.account.findUnique({ where: { userId } });
    const cashBalance = account?.balance || 0;
    const now         = new Date();
    const in5Days     = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    const dueSoon = [];
    for (const m of activeMemberships) {
      const required = getTierAmount(m.group.tier);
      for (const cycle of m.group.cycles) {
        if (cycle.recipientId === userId) continue; // recipients don't pay their own cycle
        const due = new Date(cycle.dueDate);
        if (due >= now && due <= in5Days && cashBalance < required) {
          dueSoon.push({
            groupId:      m.groupId,
            tier:         m.group.tier,
            daysLeft:     Math.ceil((due - now) / (1000 * 60 * 60 * 24)),
            required,
            cashBalance,
          });
        }
      }
    }

    return res.json({ success: true, data: { suspended, blacklisted, dueSoon } });
  } catch (err) { next(err); }
});

router.get('/:groupId', authenticate, stokvelController.getGroup);
router.get('/:groupId/members', authenticate, stokvelController.getGroupMembers);
router.post('/:groupId/swap', authenticate, financialLimiter, stokvelController.requestSwap);
router.put('/:groupId/swap/:swapId/accept', authenticate, stokvelController.acceptSwap);
router.put('/:groupId/swap/:swapId/reject', authenticate, stokvelController.rejectSwap);

module.exports = router;
