const express = require('express');
const { authenticate } = require('../../../../shared/middleware/auth');
const { financialLimiter } = require('../../../../shared/middleware/rateLimiter');
const cycleController = require('../controllers/cycle.controller');

const router = express.Router();

router.get('/:groupId/cycles', authenticate, cycleController.getGroupCycles);
router.get('/:groupId/cycles/current', authenticate, cycleController.getCurrentCycle);
router.post('/:groupId/contribute', authenticate, financialLimiter, cycleController.contribute);

module.exports = router;

// Reinstate suspended member after repayment
router.post('/:groupId/reinstate', authenticate, financialLimiter, cycleController.reinstateMember);

// TEST ONLY manually trigger dropout coverage for a member
// Remove before production
router.post('/:groupId/test-dropout/:userId', async (req, res, next) => {
  try {
    const prisma = require('../../../../shared/config/database');
    const { handleDropout } = require('../controllers/cycle.controller');
    const { getTierAmount } = require('../../../../shared/utils/money');

    const { groupId, userId } = req.params;

    const cycle = await prisma.stokvelCycle.findFirst({
      where: { groupId, status: 'collecting' },
    });
    if (!cycle) return res.json({ success: false, message: 'No active cycle' });

    const group = await prisma.stokvelGroup.findUnique({ where: { id: groupId } });

    const result = await prisma.$transaction(async (tx) => {
      return await handleDropout(tx, groupId, userId, cycle.id, group.tier);
    });

    // Check if all 3 now paid trigger payout if so
    const paidCount = await prisma.stokvelContribution.count({
      where: {
        cycleId: cycle.id,
        type:    'contribution',
        status:  { in: ['paid', 'covered_by_backup'] },
      },
    });

    if (paidCount >= 3) {
      const { splitContribution } = require('../../../../shared/utils/money');
      const { toPot } = splitContribution(getTierAmount(group.tier));
      const totalPot  = toPot * 3;

      await prisma.$transaction(async (tx) => {
        await tx.account.update({
          where: { userId: cycle.recipientId },
          data:  { balance: { increment: totalPot } },
        });
        await tx.stokvelCycle.update({
          where: { id: cycle.id },
          data:  { status: 'paid', paidAt: new Date(), totalPot },
        });
        if (cycle.cycleNumber < 3) {
          await tx.stokvelCycle.updateMany({
            where: { groupId, cycleNumber: cycle.cycleNumber + 1 },
            data:  { status: 'collecting' },
          });
          await tx.stokvelGroup.update({
            where: { id: groupId },
            data:  { currentCycle: cycle.cycleNumber + 1 },
          });
        } else {
          const { getSecurityDeposit } = require('../../../../shared/utils/money');
          const members = await tx.stokvelMember.findMany({
            where: { groupId, status: { in: ['active', 'completed'] } },
          });
          for (const m of members) {
            await tx.account.update({
              where: { userId: m.userId },
              data:  { balance: { increment: getSecurityDeposit(group.tier) } },
            });
            await tx.stokvelMember.update({
              where: { id: m.id },
              data:  { status: 'completed' },
            });
          }
          await tx.escrowAccount.update({
            where: { groupId },
            data:  { securityFund: 0, released: true },
          });
          await tx.stokvelGroup.update({
            where: { id: groupId },
            data:  { status: 'completed' },
          });
        }
      });
      result.payoutTriggered = true;
      result.payoutAmount    = totalPot;
      result.recipientId     = cycle.recipientId;
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});
