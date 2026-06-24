const prisma  = require('../../../../shared/config/database');
const logger  = require('../../../../shared/config/logger');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');
const { getTierAmount, splitContribution, getSecurityDeposit } = require('../../../../shared/utils/money');
const { publish } = require('../../../../shared/config/rabbitmq');

async function getGroupCycles(req, res, next) {
  try {
    const cycles = await prisma.stokvelCycle.findMany({
      where:   { groupId: req.params.groupId },
      include: { contributions: true },
      orderBy: { cycleNumber: 'asc' },
    });
    return sendSuccess(res, { cycles });
  } catch (err) { next(err); }
}

async function getCurrentCycle(req, res, next) {
  try {
    const cycle = await prisma.stokvelCycle.findFirst({
      where:   { groupId: req.params.groupId, status: 'collecting' },
      include: { contributions: true },
    });
    if (!cycle) return sendError(res, 404, 'No active cycle found');
    return sendSuccess(res, { cycle });
  } catch (err) { next(err); }
}

async function contribute(req, res, next) {
  try {
    const { groupId } = req.params;
    const userId      = req.user.id;

    const member = await prisma.stokvelMember.findFirst({ where: { groupId, userId } });
    if (!member) return sendError(res, 403, 'You are not a member of this group');
    if (member.status === 'suspended') {
      return sendError(res, 403, 'Your membership is suspended. Top up your wallet and repay your missed contribution.');
    }
    if (member.status === 'blacklisted') {
      return sendError(res, 403, 'Your membership has been blacklisted. Please contact support.');
    }

    const cycle = await prisma.stokvelCycle.findFirst({ where: { groupId, status: 'collecting' } });
    if (!cycle) return sendError(res, 400, 'No active cycle to contribute to');

    const existing = await prisma.stokvelContribution.findFirst({
      where: { cycleId: cycle.id, userId, type: 'contribution', status: 'paid' },
    });
    if (existing) return sendError(res, 409, 'You have already contributed this cycle');

    const group  = await prisma.stokvelGroup.findUnique({ where: { id: groupId } });
    const amount = getTierAmount(group.tier);
    const { platformFee, toPot } = splitContribution(amount);

    const account = await prisma.account.findUnique({ where: { userId } });
    if (!account || account.balance < amount) {
      return sendError(res, 400, `Insufficient balance. Need R${amount / 100}, have R${(account?.balance || 0) / 100}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.account.update({ where: { userId }, data: { balance: { decrement: amount } } });

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

      await tx.escrowAccount.update({
        where: { groupId },
        data:  { platformFees: { increment: platformFee } },
      });

      const paidCount = await tx.stokvelContribution.count({
        where: { cycleId: cycle.id, type: 'contribution', status: { in: ['paid', 'covered_by_backup'] } },
      });

      if (paidCount >= 3) {
        await _processPayout(tx, cycle, group, toPot);
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

async function reinstateMember(req, res, next) {
  try {
    const { groupId } = req.params;
    const userId      = req.user.id;

    const member = await prisma.stokvelMember.findFirst({ where: { groupId, userId, status: 'suspended' } });
    if (!member) return sendError(res, 404, 'No suspended membership found');

    const group   = await prisma.stokvelGroup.findUnique({ where: { id: groupId } });
    const toPot   = splitContribution(getTierAmount(group.tier)).toPot;
    const account = await prisma.account.findUnique({ where: { userId } });

    if (!account || account.balance < toPot) {
      return sendError(res, 400, `Insufficient balance. Need R${toPot / 100} to repay.`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.account.update({ where: { userId }, data: { balance: { decrement: toPot } } });
      await tx.escrowAccount.update({ where: { groupId }, data: { securityFund: { increment: toPot } } });
      await tx.stokvelMember.update({ where: { id: member.id }, data: { status: 'active' } });
    });

    publish('stokvel.member.reinstated', { userId, groupId }).catch(() => {});
    return sendSuccess(res, null, `Reinstated. R${toPot / 100} repaid.`);

  } catch (err) { next(err); }
}

// ── Handle dropout ────────────────────────────────────────────────────────────
async function handleDropout(tx, groupId, userId, cycleId, tier) {
  const { toPot }      = splitContribution(getTierAmount(tier));
  const depositAmount  = getSecurityDeposit(tier);
  const escrow         = await tx.escrowAccount.findUnique({ where: { groupId } });
  const availableFunds = (escrow?.securityFund || 0) + (escrow?.backupFund || 0);

  logger.warn(`Dropout: member ${userId} in group ${groupId}. Escrow: R${availableFunds / 100}. Need: R${toPot / 100}`);

  if (availableFunds >= toPot) {
    // ── COVERED ──────────────────────────────────────────────────────────────
    await tx.escrowAccount.update({
      where: { groupId },
      data:  { securityFund: { decrement: toPot } },
    });

    // Get memberId for the contribution record
    const memberRecord = await tx.stokvelMember.findFirst({ where: { groupId, userId } });

    // Check if already has a contribution record for this cycle
    const existingContrib = await tx.stokvelContribution.findFirst({
      where: { cycleId, userId, type: 'contribution' },
    });

    if (existingContrib) {
      await tx.stokvelContribution.update({
        where: { id: existingContrib.id },
        data:  { status: 'covered_by_backup' },
      });
    } else {
      await tx.stokvelContribution.create({
        data: {
          cycleId,
          groupId,
          userId,
          memberId: memberRecord?.id,
          amount:   toPot,
          type:     'contribution',
          status:   'covered_by_backup',
          paidAt:   new Date(),
        },
      });
    }

    // Blacklist if already received payout, otherwise suspend
    const receivedPayout = await tx.stokvelCycle.findFirst({
      where: { groupId, recipientId: userId, status: 'paid' },
    });

    if (receivedPayout) {
      await tx.stokvelMember.updateMany({
        where: { groupId, userId },
        data:  { status: 'blacklisted' },
      });
      logger.error(`Member ${userId} BLACKLISTED — received payout then defaulted`);
      publish('stokvel.member.blacklisted', { userId, groupId }).catch(() => {});
    } else {
      await tx.stokvelMember.updateMany({
        where: { groupId, userId },
        data:  { status: 'suspended' },
      });
      logger.warn(`Member ${userId} suspended — covered by escrow. Owes: R${toPot / 100}`);
      publish('stokvel.member.suspended', { userId, groupId, amountOwed: toPot }).catch(() => {});
    }

    return { covered: true, amountCovered: toPot };

  } else {
    // ── NOT COVERED — refund everyone and cancel ──────────────────────────────
    logger.warn(`Group ${groupId} — escrow insufficient. Reversing all contributions.`);

    const paidContributions = await tx.stokvelContribution.findMany({
      where: { cycleId, type: 'contribution', status: 'paid' },
    });

    for (const contribution of paidContributions) {
      const refundAmount = getTierAmount(tier);
      await tx.account.update({
        where: { userId: contribution.userId },
        data:  { balance: { increment: refundAmount } },
      });
      await tx.stokvelContribution.update({
        where: { id: contribution.id },
        data:  { status: 'refunded' },
      });
      logger.info(`Refunded R${refundAmount / 100} to ${contribution.userId}`);
    }

    const members = await tx.stokvelMember.findMany({ where: { groupId } });

    for (const member of members) {
      await tx.account.update({
        where: { userId: member.userId },
        data:  { balance: { increment: depositAmount } },
      });
      await tx.stokvelMember.update({
        where: { id: member.id },
        data:  { status: 'completed' },
      });
    }

    await tx.escrowAccount.update({
      where: { groupId },
      data:  { securityFund: 0, platformFees: 0, released: true },
    });

    await tx.stokvelGroup.update({
      where: { id: groupId },
      data:  { status: 'cancelled' },
    });

    for (const member of members) {
      publish('stokvel.group.cancelled', {
        groupId,
        userId:  member.userId,
        reason:  'Group cancelled — dropout could not be covered. All funds returned.',
      }).catch(() => {});
    }

    logger.info(`Group ${groupId} cancelled — all funds returned`);
    return { covered: false, refunded: true, groupCancelled: true };
  }
}

// ── Process payout ────────────────────────────────────────────────────────────
async function _processPayout(tx, cycle, group, toPot) {
  const totalPot = toPot * 3;

  await tx.account.update({ where: { userId: cycle.recipientId }, data: { balance: { increment: totalPot } } });
  await tx.stokvelCycle.update({ where: { id: cycle.id }, data: { status: 'paid', paidAt: new Date(), totalPot } });

  logger.info(`Payout R${totalPot / 100} to ${cycle.recipientId}`);

  if (cycle.cycleNumber < 3) {
    await tx.stokvelCycle.updateMany({
      where: { groupId: cycle.groupId, cycleNumber: cycle.cycleNumber + 1 },
      data:  { status: 'collecting' },
    });
    await tx.stokvelGroup.update({
      where: { id: cycle.groupId },
      data:  { currentCycle: cycle.cycleNumber + 1 },
    });
    publish('stokvel.cycle.paid', { groupId: cycle.groupId, cycleNumber: cycle.cycleNumber, recipientId: cycle.recipientId, amount: totalPot }).catch(() => {});
  } else {
    await _completeGroup(tx, cycle.groupId, group.tier);
  }
}

// ── Complete group ────────────────────────────────────────────────────────────
async function _completeGroup(tx, groupId, tier) {
  const depositAmount = getSecurityDeposit(tier);
  const members = await tx.stokvelMember.findMany({
    where: { groupId, status: { in: ['active', 'completed'] } },
  });

  for (const member of members) {
    await tx.account.update({ where: { userId: member.userId }, data: { balance: { increment: depositAmount } } });
    await tx.stokvelMember.update({ where: { id: member.id }, data: { status: 'completed' } });
    logger.info(`Deposit R${depositAmount / 100} returned to ${member.userId}`);
  }

  await tx.escrowAccount.update({ where: { groupId }, data: { securityFund: 0, released: true } });
  await tx.stokvelGroup.update({ where: { id: groupId }, data: { status: 'completed' } });

  logger.info(`Group ${groupId} completed`);
  publish('stokvel.group.completed', { groupId, tier, memberIds: members.map(m => m.userId) }).catch(() => {});
}

module.exports = { getGroupCycles, getCurrentCycle, contribute, reinstateMember, handleDropout };
