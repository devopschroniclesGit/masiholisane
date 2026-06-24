const prisma = require('../../../../shared/config/database');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');
const { getTierAmount, splitContribution, getSecurityDeposit } = require('../../../../shared/utils/money');
const { publish } = require('../../../../shared/config/rabbitmq');
const logger = require('../../../../shared/config/logger');

async function getGroupCycles(req, res, next) {
  try {
    const cycles = await prisma.stokvelCycle.findMany({
      where: { groupId: req.params.groupId },
      include: { contributions: true },
      orderBy: { cycleNumber: 'asc' },
    });
    return sendSuccess(res, { cycles });
  } catch (err) { next(err); }
}

async function getCurrentCycle(req, res, next) {
  try {
    const cycle = await prisma.stokvelCycle.findFirst({
      where: { groupId: req.params.groupId, status: 'collecting' },
      include: { contributions: true },
    });
    if (!cycle) return sendError(res, 404, 'No active cycle found');
    return sendSuccess(res, { cycle });
  } catch (err) { next(err); }
}

async function contribute(req, res, next) {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    // 1. Check membership
    const member = await prisma.stokvelMember.findFirst({
      where: { groupId, userId },
    });
    if (!member) return sendError(res, 403, 'You are not a member of this group');
    if (member.status === 'suspended') {
      return sendError(res, 403, 'Your membership is suspended — top up wallet and contact support');
    }

    // 2. Find active cycle
    const cycle = await prisma.stokvelCycle.findFirst({
      where: { groupId, status: 'collecting' },
    });
    if (!cycle) return sendError(res, 400, 'No active cycle to contribute to');

    // 3. Check not already paid
    const existing = await prisma.stokvelContribution.findFirst({
      where: { cycleId: cycle.id, userId, type: 'contribution', status: 'paid' },
    });
    if (existing) return sendError(res, 409, 'You have already contributed this cycle');

    // 4. Get amounts
    const group = await prisma.stokvelGroup.findUnique({ where: { id: groupId } });
    const amount = getTierAmount(group.tier);
    const { platformFee, toPot } = splitContribution(amount);

    // 5. Check wallet balance
    const account = await prisma.account.findUnique({ where: { userId } });
    if (!account || account.balance < amount) {
      return sendError(res, 400,
        `Insufficient balance. Need R${amount / 100}, have R${(account?.balance || 0) / 100}`
      );
    }

    // 6. Process in transaction
    await prisma.$transaction(async (tx) => {

      // Deduct from wallet
      await tx.account.update({
        where: { userId },
        data:  { balance: { decrement: amount } },
      });

      // Record contribution
      await tx.stokvelContribution.create({
        data: {
          cycleId:  cycle.id,
          groupId,
          userId,
          memberId: member.id,
          amount:   toPot,
          type:     'contribution',
          status:   'paid',
          paidAt:   new Date(),
        },
      });

      // Add platform fee to escrow
      await tx.escrowAccount.update({
        where: { groupId },
        data:  { platformFees: { increment: platformFee } },
      });

      // 7. Check if all 3 paid
      const paidCount = await tx.stokvelContribution.count({
        where: {
          cycleId: cycle.id,
          type:    'contribution',
          status:  { in: ['paid', 'covered_by_backup'] },
        },
      });

      if (paidCount >= 3) {
        const totalPot = toPot * 3;

        // Pay out to recipient
        await tx.account.update({
          where: { userId: cycle.recipientId },
          data:  { balance: { increment: totalPot } },
        });

        // Mark cycle paid
        await tx.stokvelCycle.update({
          where: { id: cycle.id },
          data:  { status: 'paid', paidAt: new Date(), totalPot },
        });

        logger.info(`Cycle ${cycle.cycleNumber} paid out R${totalPot / 100} to ${cycle.recipientId}`);

        if (cycle.cycleNumber < 3) {
          // Advance to next cycle
          await tx.stokvelCycle.updateMany({
            where: { groupId, cycleNumber: cycle.cycleNumber + 1 },
            data:  { status: 'collecting' },
          });
          await tx.stokvelGroup.update({
            where: { id: groupId },
            data:  { currentCycle: cycle.cycleNumber + 1 },
          });

          publish('stokvel.cycle.paid', {
            groupId,
            cycleNumber: cycle.cycleNumber,
            recipientId: cycle.recipientId,
            amount:      totalPot,
            nextCycle:   cycle.cycleNumber + 1,
          }).catch(() => {});

        } else {
          // Final cycle — complete group and return deposits
          await _completeGroup(tx, groupId, group.tier);
        }
      }
    });

    return sendSuccess(res, {
      contributed: amount,
      toPot,
      platformFee,
      message: `R${amount / 100} contributed. R${platformFee / 100} platform fee. R${toPot / 100} added to pot.`,
    }, 'Contribution successful');

  } catch (err) { next(err); }
}

// ── Complete group — return security deposits ─────────────────────────────────
async function _completeGroup(tx, groupId, tier) {
  const depositAmount = getSecurityDeposit(tier);

  // Get all active/completed members
  const members = await tx.stokvelMember.findMany({
    where: { groupId, status: { in: ['active', 'completed'] } },
  });

  let totalReturned = 0;

  for (const member of members) {
    // Return security deposit to wallet
    await tx.account.update({
      where: { userId: member.userId },
      data:  { balance: { increment: depositAmount } },
    });

    // Mark member as completed
    await tx.stokvelMember.update({
      where: { id: member.id },
      data:  { status: 'completed' },
    });

    totalReturned += depositAmount;
    logger.info(`Security deposit R${depositAmount / 100} returned to ${member.userId}`);
  }

  // Mark escrow as released
  await tx.escrowAccount.update({
    where: { groupId },
    data:  {
      securityFund: 0,
      released:     true,
    },
  });

  // Mark group as completed
  await tx.stokvelGroup.update({
    where: { id: groupId },
    data:  { status: 'completed' },
  });

  logger.info(`Group ${groupId} completed. R${totalReturned / 100} security deposits returned.`);

  publish('stokvel.group.completed', {
    groupId,
    tier,
    memberIds:      members.map(m => m.userId),
    depositReturned: depositAmount,
  }).catch(() => {});
}

module.exports = { getGroupCycles, getCurrentCycle, contribute };
