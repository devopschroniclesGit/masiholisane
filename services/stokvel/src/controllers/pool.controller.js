const prisma  = require('../../../../shared/config/database');
const logger  = require('../../../../shared/config/logger');
const { publish } = require('../../../../shared/config/rabbitmq');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');
const { getTierAmount, getSecurityDeposit, getMinimumJoinBalance } = require('../../../../shared/utils/money');
const { calculateCycleDueDate } = require('../../../../shared/utils/dates');

const VALID_TIERS     = [1, 2, 3];
const GROUP_FILL_DAYS = 7;

async function getPoolStatus(req, res, next) {
  try {
    const tier = parseInt(req.params.tier);
    if (!VALID_TIERS.includes(tier)) {
      return sendError(res, 400, 'Invalid tier. Must be 1, 2, or 3');
    }

    const formingGroup   = await prisma.stokvelGroup.findFirst({
      where: { tier, status: 'forming' },
      include: { members: true },
    });

    const currentMembers = formingGroup?.members?.length || 0;
    const spotsRemaining = 3 - currentMembers;

    return sendSuccess(res, {
      tier,
      contributionAmount: getTierAmount(tier),
      securityDeposit:    getSecurityDeposit(tier),
      minimumJoinBalance: getMinimumJoinBalance(tier),
      currentMembers,
      spotsRemaining,
      hasFormingGroup:    !!formingGroup,
      estimatedStart:     spotsRemaining === 0 ? 'Starting now' : `When ${spotsRemaining} more member(s) join`,
    });
  } catch (err) { next(err); }
}

async function joinPool(req, res, next) {
  try {
    const { tier } = req.body;
    const userId   = req.user.id;

    if (!VALID_TIERS.includes(parseInt(tier))) {
      return sendError(res, 400, 'Invalid tier. Must be 1, 2, or 3');
    }
    const tierInt = parseInt(tier);

    const existingMembership = await prisma.stokvelMember.findFirst({
      where: {
        userId,
        status: 'active',
        group: { tier: tierInt, status: { in: ['forming', 'active'] } },
      },
    });
    if (existingMembership) {
      return sendError(res, 409, `You are already in a Tier ${tierInt} group`);
    }

    const totalActiveGroups = await prisma.stokvelMember.count({
      where: {
        userId,
        status: 'active',
        group: { status: { in: ['forming', 'active'] } },
      },
    });
    if (totalActiveGroups >= 2) {
      return sendError(res, 409, 'You are already in 2 active groups. Complete a group before joining another.');
    }

    const account    = await prisma.account.findUnique({ where: { userId } });
    if (!account) return sendError(res, 404, 'Wallet not found');

    const trustScore = await prisma.trustScore.findUnique({ where: { userId } });
    const tierAmount = getTierAmount(tierInt);

    if (account.balance < tierAmount) {
      const needed = tierAmount - account.balance;
      return sendError(res, 400, `You need R${(needed / 100).toFixed(2)} more in your wallet to join Tier ${tierInt}. Joining locks in your first cycle contribution of R${(tierAmount / 100).toFixed(2)}.`);
    }

    const minScoreForTier = { 1: 10, 2: 50, 3: 70 }; // Tier 1 = ID-verification floor only, since joining already requires it
    const currentScore    = trustScore?.score || 0;
    if (currentScore < minScoreForTier[tierInt]) {
      return sendError(res, 403,
        `Your Trust Score (${currentScore}) is too low for Tier ${tierInt}. Minimum required: ${minScoreForTier[tierInt]}`
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const formingGroup = await tx.stokvelGroup.findFirst({
        where: { tier: tierInt, status: 'forming' },
        include: { members: true },
      });

      let group = formingGroup;

      if (!group) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + GROUP_FILL_DAYS);
        group = await tx.stokvelGroup.create({
          data: { tier: tierInt, status: 'forming', cycleDay: 0, expiresAt },
          include: { members: true },
        });
        logger.info(`New Tier ${tierInt} group created: ${group.id}`);
      }

      // Calculate position and whether this completes the group
      const existingCount = group.members?.length || 0;
      const updatedCount  = existingCount + 1;
      const isLastMember  = updatedCount === 3;

      // Use temporary position 99 for the last member to avoid unique constraint
      // during position randomisation in _activateGroup
      const assignedPosition = isLastMember ? 99 : updatedCount;

      const member = await tx.stokvelMember.create({
        data: { groupId: group.id, userId, position: assignedPosition, status: 'active' },
      });

      // ── RESERVATION: Deduct first cycle contribution immediately ─────────
      // Re-check balance inside transaction to prevent race conditions
      const currentAccount = await tx.account.findUnique({ where: { userId } });
      if (currentAccount.balance < tierAmount) {
        throw new Error(`Insufficient balance. You may already be committed to another group. Need R${tierAmount/100}, have R${currentAccount.balance/100}`);
      }

      await tx.account.update({
        where: { userId },
        data:  { balance: { decrement: tierAmount } },
      });

      // Record the reservation transaction
      await tx.transaction.create({
        data: {
          fromAccountId:  currentAccount.id,
          amount:         tierAmount,
          type:           'contribution',
          status:         'completed',
          idempotencyKey: `reserve-${group.id}-${userId}`,
          description:    `Tier ${tierInt} reservation locked in (first cycle contribution)`,
        },
      });

      if (isLastMember) {
        await _activateGroup(tx, group.id, tierInt);
        const allMembers = await tx.stokvelMember.findMany({ where: { groupId: group.id } });
        const cycle1     = await tx.stokvelCycle.findFirst({
          where: { groupId: group.id, cycleNumber: 1 },
        });

        // Refund the Cycle 1 recipient — they should not have contributed to their own cycle
        const recipientAcct = await tx.account.findUnique({ where: { userId: cycle1.recipientId } });
        if (recipientAcct) {
          await tx.account.update({
            where: { userId: cycle1.recipientId },
            data:  { balance: { increment: tierAmount } },
          });
          await tx.transaction.create({
            data: {
              toAccountId:    recipientAcct.id,
              amount:         tierAmount,
              type:           'refund',
              status:         'completed',
              idempotencyKey: `recipient-refund-${cycle1.id}-${cycle1.recipientId}`,
              description:    `Reservation refunded — you are Cycle 1 recipient`,
            },
          });
        }

        // Create Cycle 1 contributions for non-recipient members
        for (const m of allMembers) {
          if (m.userId === cycle1.recipientId) continue;
          await tx.stokvelContribution.create({
            data: {
              cycleId:  cycle1.id,
              groupId:  group.id,
              userId:   m.userId,
              memberId: m.id,
              amount:   tierAmount,
              type:     'contribution',
              status:   'paid',
              paidAt:   new Date(),
            },
          });
        }
        // Trigger payout to recipient since both contributions exist now
        const paidCount = await tx.stokvelContribution.count({
          where: { cycleId: cycle1.id, type: 'contribution', status: 'paid' },
        });
        if (paidCount >= 2) {
          const totalPot = tierAmount * 2;
          const recipientAccount = await tx.account.findUnique({ where: { userId: cycle1.recipientId } });
          if (recipientAccount) {
            await tx.account.update({
              where: { userId: cycle1.recipientId },
              data:  { balance: { increment: totalPot } },
            });
            await tx.transaction.create({
              data: {
                toAccountId:    recipientAccount.id,
                amount:         totalPot,
                type:           'payout',
                status:         'completed',
                idempotencyKey: `payout-${cycle1.id}-${Date.now()}`,
                description:    `Stokvel payout — Tier ${tierInt} cycle 1`,
              },
            });
          }
          await tx.stokvelCycle.update({
            where: { id: cycle1.id },
            data:  { status: 'paid', paidAt: new Date(), totalPot },
          });
          // Move to cycle 2
          await tx.stokvelCycle.updateMany({
            where: { groupId: group.id, cycleNumber: 2 },
            data:  { status: 'collecting' },
          });
          await tx.stokvelGroup.update({
            where: { id: group.id },
            data:  { currentCycle: 2 },
          });
        }
      }

      return { group, member, groupFull: isLastMember, updatedCount };
    });

    // Get the actual position after randomisation
    const finalMember = await prisma.stokvelMember.findFirst({
      where: { groupId: result.group.id, userId },
    });

    return sendSuccess(res, {
      groupId:     result.group.id,
      tier:        tierInt,
      position:    finalMember?.position || result.member.position,
      groupStatus: result.groupFull ? 'active' : 'forming',
      message:     result.groupFull
        ? 'Group is full and has started! Check your dashboard for cycle details.'
        : `You have joined the Tier ${tierInt} pool. Waiting for ${3 - result.updatedCount} more member(s).`,
    }, 'Successfully joined the pool', 201);

  } catch (err) { next(err); }
}

async function leavePool(req, res, next) {
  try {
    const { groupId } = req.params;
    const userId      = req.user.id;

    const membership = await prisma.stokvelMember.findFirst({
      where:   { groupId, userId },
      include: { group: true },
    });

    if (!membership) return sendError(res, 404, 'You are not a member of this group');
    if (membership.group.status !== 'forming') {
      return sendError(res, 400, 'Cannot leave a group that has already started');
    }

    // Calculate cancellation fee
    const CANCEL_FEES        = { 1: 2500, 2: 5000, 3: 10000 }; // in cents
    const FREE_CANCEL_MS     = 60 * 60 * 1000; // 1 hour
    const elapsedMs          = Date.now() - new Date(membership.joinedAt).getTime();
    const feeApplies         = elapsedMs > FREE_CANCEL_MS;
    const feeAmount          = feeApplies ? CANCEL_FEES[membership.group.tier] : 0;

    // Deduct fee from wallet if applicable
    if (feeAmount > 0) {
      const account = await prisma.account.findUnique({ where: { userId } });
      if (!account || account.balance < feeAmount) {
        return sendError(res, 400, `Insufficient balance for R${feeAmount/100} cancellation fee`);
      }

      await prisma.$transaction([
        prisma.account.update({
          where: { userId },
          data:  { balance: { decrement: feeAmount } },
        }),
        prisma.transaction.create({
          data: {
            fromAccountId:  account.id,
            amount:         feeAmount,
            type:           'fee',
            status:         'completed',
            idempotencyKey: `cancel-fee-${membership.id}-${Date.now()}`,
            description:    `Cancellation fee Tier ${membership.group.tier} pool`,
          },
        }),
      ]);

      // Add fee to platform fees in escrow if it exists
      const escrow = await prisma.escrowAccount.findUnique({ where: { groupId } });
      if (escrow) {
        await prisma.escrowAccount.update({
          where: { groupId },
          data:  { platformFees: { increment: feeAmount } },
        });
      }
    }

    // Refund the reservation amount (first cycle contribution)
    const { getTierAmount } = require('../../../../shared/utils/money');
    const tierAmount = getTierAmount(membership.group.tier);
    const account    = await prisma.account.findUnique({ where: { userId } });
    const refundAmount = tierAmount - feeAmount;

    if (refundAmount > 0 && account) {
      await prisma.account.update({
        where: { userId },
        data:  { balance: { increment: refundAmount } },
      });
      await prisma.transaction.create({
        data: {
          toAccountId:    account.id,
          amount:         refundAmount,
          type:           'refund',
          status:         'completed',
          idempotencyKey: `leave-refund-${membership.id}-${Date.now()}`,
          description:    feeApplies
            ? `Reservation refunded (less R${feeAmount/100} cancellation fee)`
            : `Reservation refunded — left pool`,
        },
      });
    }

    await prisma.stokvelMember.delete({ where: { id: membership.id } });

    const remaining = await prisma.stokvelMember.count({ where: { groupId } });
    if (remaining === 0) {
      await prisma.stokvelGroup.delete({ where: { id: groupId } });
    }

    const message = feeApplies
      ? `Left pool. R${refundAmount/100} refunded, R${feeAmount/100} cancellation fee charged.`
      : `Left pool. R${refundAmount/100} refunded to your wallet.`;

    return sendSuccess(res, { feeCharged: feeAmount }, message);
  } catch (err) { next(err); }
}

async function _activateGroup(tx, groupId, tier) {
  const members = await tx.stokvelMember.findMany({
    where: { groupId },
    orderBy: { joinedAt: 'asc' },
  });

  // Randomise positions using Fisher-Yates shuffle
  const positions = [1, 2, 3];
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  // First set all positions to temporary values to avoid unique conflicts
  for (let i = 0; i < members.length; i++) {
    await tx.stokvelMember.update({
      where: { id: members[i].id },
      data:  { position: 100 + i },
    });
  }

  // Then assign final positions
  for (let i = 0; i < members.length; i++) {
    await tx.stokvelMember.update({
      where: { id: members[i].id },
      data:  { position: positions[i] },
    });
  }

  // Create cycles with proper due dates
  const activationDate = new Date();

  for (let cycleNum = 1; cycleNum <= 3; cycleNum++) {
    const dueDate   = calculateCycleDueDate(activationDate, cycleNum);
    const recipient = members.find((_, i) => positions[i] === cycleNum);

    await tx.stokvelCycle.create({
      data: {
        groupId,
        cycleNumber: cycleNum,
        recipientId: recipient.userId,
        status:      cycleNum === 1 ? 'collecting' : 'pending',
        dueDate,
      },
    });
  }

  // Create escrow account
  await tx.escrowAccount.create({ data: { groupId } });

  // Activate group
  await tx.stokvelGroup.update({
    where: { id: groupId },
    data:  { status: 'active', currentCycle: 1 },
  });

  logger.info(`Group ${groupId} activated`);

  publish('stokvel.group.started', {
    groupId, tier,
    memberIds: members.map(m => m.userId),
  }).catch(err => logger.warn('Failed to publish: ' + err.message));
}

async function _collectSecurityDeposits(tx, groupId, tier, members) {
  const depositAmount = getSecurityDeposit(tier);

  const escrow = await tx.escrowAccount.findUnique({ where: { groupId } });

  for (const member of members) {
    const account = await tx.account.findUnique({ where: { userId: member.userId } });

    if (!account || account.balance < depositAmount) {
      logger.warn(`Member ${member.userId} insufficient balance for security deposit`);
      continue;
    }

    await tx.account.update({
      where: { userId: member.userId },
      data:  { balance: { decrement: depositAmount } },
    });

    await tx.escrowAccount.update({
      where: { groupId },
      data:  { securityFund: { increment: depositAmount } },
    });

    await tx.escrowTransaction.create({
      data: {
        escrowId:  escrow.id,
        userId:    member.userId,
        type:      'security_deposit',
        amount:    depositAmount,
        direction: 'in',
        reason:    `Security deposit Tier ${tier}`,
      },
    });
  }

  await tx.escrowAccount.update({
    where: { groupId },
    data:  { securityPaid: true },
  });
}


// ── GET /pool-waiting/my status of user's forming group ────────────────────
async function getMyWaitingStatus(req, res, next) {
  try {
    const userId = req.user.id;

    // Find a forming group the user is in
    const membership = await prisma.stokvelMember.findFirst({
      where: {
        userId,
        status: 'active',
        group:  { status: 'forming' },
      },
      include: {
        group: { include: { members: true } },
      },
    });

    if (!membership) {
      return sendSuccess(res, { waiting: false });
    }

    const group          = membership.group;
    const currentMembers = group.members?.length || 0;
    const spotsRemaining = 3 - currentMembers;
    const progressPct    = Math.round((currentMembers / 3) * 100);

    // Time since group started forming
    const createdAt   = new Date(group.createdAt);
    const hoursWaiting = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60));
    const expiresAt   = new Date(group.expiresAt);
    const hoursLeft   = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));

    return sendSuccess(res, {
      waiting:         true,
      groupId:         group.id,
      tier:            group.tier,
      currentMembers,
      spotsRemaining,
      progressPct,
      yourPosition:    membership.position === 99 ? currentMembers : membership.position,
      hoursWaiting,
      hoursLeft,
      expiresAt:       group.expiresAt,
    });
  } catch (err) { next(err); }
}

module.exports = { getPoolStatus, joinPool, leavePool, getMyWaitingStatus };
