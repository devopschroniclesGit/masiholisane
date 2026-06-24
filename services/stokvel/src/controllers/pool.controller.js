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

    const trustScore     = await prisma.trustScore.findUnique({ where: { userId } });
    const requireDeposit = !trustScore || trustScore.score < 70;
    const minBalance     = getMinimumJoinBalance(tierInt, requireDeposit);

    if (account.balance < minBalance) {
      const needed = minBalance - account.balance;
      return sendError(res, 400, `Insufficient balance. You need R${(needed / 100).toFixed(2)} more to join.`);
    }

    const minScoreForTier = { 1: 30, 2: 50, 3: 70 };
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

      if (isLastMember) {
        await _activateGroup(tx, group.id, tierInt);
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
      where: { groupId, userId },
      include: { group: true },
    });

    if (!membership) return sendError(res, 404, 'You are not a member of this group');
    if (membership.group.status !== 'forming') {
      return sendError(res, 400, 'Cannot leave a group that has already started');
    }

    await prisma.stokvelMember.delete({ where: { id: membership.id } });

    const remaining = await prisma.stokvelMember.count({ where: { groupId } });
    if (remaining === 0) {
      await prisma.stokvelGroup.delete({ where: { id: groupId } });
    }

    return sendSuccess(res, null, 'You have left the pool');
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

  // Collect security deposits
  await _collectSecurityDeposits(tx, groupId, tier, members);

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

module.exports = { getPoolStatus, joinPool, leavePool };
