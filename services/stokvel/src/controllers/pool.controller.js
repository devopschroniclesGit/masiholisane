// services/stokvel/src/controllers/pool.controller.js
// Handles open pool joining and group auto-assembly

const prisma  = require('../../../../shared/config/database');
const logger  = require('../../../../shared/config/logger');
const { publish } = require('../../../../shared/config/rabbitmq');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');
const { AppError } = require('../../../../shared/middleware/errorHandler');
const {
  getTierAmount,
  getSecurityDeposit,
  getMinimumJoinBalance,
  splitContribution,
  LOYALTY_BONUS,
} = require('../../../../shared/utils/money');

const VALID_TIERS = [1, 2, 3];
const GROUP_FILL_DAYS = 7; // cancel if not filled in 7 days

// ── GET /pool/:tier ───────────────────────────────────────────────────────────
async function getPoolStatus(req, res, next) {
  try {
    const tier = parseInt(req.params.tier);

    if (!VALID_TIERS.includes(tier)) {
      return sendError(res, 400, 'Invalid tier. Must be 1, 2, or 3');
    }

    // Find forming group for this tier
    const formingGroup = await prisma.stokvelGroup.findFirst({
      where: { tier, status: 'forming' },
      include: { members: true },
    });

    const currentMembers = formingGroup?.members?.length || 0;
    const spotsRemaining = 3 - currentMembers;

    return sendSuccess(res, {
      tier,
      contributionAmount: getTierAmount(tier),
      securityDeposit: getSecurityDeposit(tier),
      minimumJoinBalance: getMinimumJoinBalance(tier),
      currentMembers,
      spotsRemaining,
      hasFormingGroup: !!formingGroup,
      estimatedStart: spotsRemaining === 0 ? 'Now' : `When ${spotsRemaining} more member(s) join`,
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /join ────────────────────────────────────────────────────────────────
async function joinPool(req, res, next) {
  try {
    const { tier } = req.body;
    const userId = req.user.id;

    // 1. Validate tier
    if (!VALID_TIERS.includes(parseInt(tier))) {
      return sendError(res, 400, 'Invalid tier. Must be 1, 2, or 3');
    }
    const tierInt = parseInt(tier);

    // 2. Check user is not already in an active group for this tier
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

    // 3. Check wallet has enough balance (contribution + security deposit)
    const account = await prisma.account.findUnique({ where: { userId } });
    if (!account) {
      return sendError(res, 404, 'Wallet not found. Please contact support.');
    }

    // Check Trust Score to determine if deposit required
    const trustScore = await prisma.trustScore.findUnique({ where: { userId } });
    const requiresDeposit = !trustScore || trustScore.score < 70;
    const minBalance = getMinimumJoinBalance(tierInt, requiresDeposit);

    if (account.balance < minBalance) {
      const needed = minBalance - account.balance;
      return sendError(res, 400, `Insufficient wallet balance. You need R${(needed / 100).toFixed(2)} more to join.`);
    }

    // 4. Check Trust Score tier gate
    const minScoreForTier = { 1: 30, 2: 50, 3: 70 };
    const minScore = minScoreForTier[tierInt];
    const currentScore = trustScore?.score || 0;

    if (currentScore < minScore) {
      return sendError(res, 403,
        `Your Trust Score (${currentScore}) is too low for Tier ${tierInt}. Minimum required: ${minScore}`
      );
    }

    // 5. Find or create a forming group for this tier — use a transaction for safety
    const result = await prisma.$transaction(async (tx) => {

      // Lock: find forming group
      const formingGroup = await tx.stokvelGroup.findFirst({
        where: { tier: tierInt, status: 'forming' },
        include: { members: true },
      });

      let group = formingGroup;

      // Create new group if none forming
      if (!group) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + GROUP_FILL_DAYS);

        group = await tx.stokvelGroup.create({
          data: {
            tier: tierInt,
            status: 'forming',
            cycleDay: 15, // default to 15th of month
            expiresAt,
          },
          include: { members: true },
        });

        logger.info(`New Tier ${tierInt} group created: ${group.id}`);
      }

      // 6. Add member to group
      const position = (group.members?.length || 0) + 1;

      const member = await tx.stokvelMember.create({
        data: {
          groupId: group.id,
          userId,
          position, // temporary — randomised when group starts
          status: 'active',
        },
      });

      logger.info(`User ${userId} joined Tier ${tierInt} group ${group.id} as position ${position}`);

      const updatedMembers = (group.members?.length || 0) + 1;

      // 7. If group now has 3 members — activate it
      if (updatedMembers === 3) {
        await _activateGroup(tx, group.id, tierInt);
      }

      return { group, member, groupFull: updatedMembers === 3 };
    });

    return sendSuccess(res, {
      groupId: result.group.id,
      tier: tierInt,
      position: result.member.position,
      groupStatus: result.groupFull ? 'active' : 'forming',
      message: result.groupFull
        ? 'Group is full and has started! Check your dashboard for cycle details.'
        : `You have joined the Tier ${tierInt} pool. Waiting for ${3 - (result.group.members?.length || 0) - 1} more member(s).`,
    }, 'Successfully joined the pool', 201);

  } catch (err) {
    next(err);
  }
}

// ── DELETE /join/:groupId ─────────────────────────────────────────────────────
async function leavePool(req, res, next) {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const membership = await prisma.stokvelMember.findFirst({
      where: { groupId, userId },
      include: { group: true },
    });

    if (!membership) {
      return sendError(res, 404, 'You are not a member of this group');
    }

    if (membership.group.status !== 'forming') {
      return sendError(res, 400, 'Cannot leave a group that has already started');
    }

    await prisma.stokvelMember.delete({ where: { id: membership.id } });

    // If group is now empty — delete it
    const remaining = await prisma.stokvelMember.count({ where: { groupId } });
    if (remaining === 0) {
      await prisma.stokvelGroup.delete({ where: { id: groupId } });
    }

    return sendSuccess(res, null, 'You have left the pool');
  } catch (err) {
    next(err);
  }
}

// ── Internal: Activate group when 3 members join ──────────────────────────────
async function _activateGroup(tx, groupId, tier) {
  // 1. Get all members
  const members = await tx.stokvelMember.findMany({
    where: { groupId },
    orderBy: { joinedAt: 'asc' },
  });

  // 2. Randomise positions
  const positions = [1, 2, 3];
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  // 3. Assign positions
  for (let i = 0; i < members.length; i++) {
    await tx.stokvelMember.update({
      where: { id: members[i].id },
      data: { position: positions[i] },
    });
  }

  // 4. Create 24-hour swap window expiry
  const swapExpiry = new Date();
  swapExpiry.setHours(swapExpiry.getHours() + 24);

  // 5. Create 3 cycles
  const now = new Date();
  for (let cycleNum = 1; cycleNum <= 3; cycleNum++) {
    const dueDate = new Date(now);
    dueDate.setMonth(dueDate.getMonth() + cycleNum - 1);
    dueDate.setDate(15); // 15th of the month

    // Find recipient for this cycle (the member at this position)
    const recipient = members.find((_, i) => positions[i] === cycleNum);

    await tx.stokvelCycle.create({
      data: {
        groupId,
        cycleNumber: cycleNum,
        recipientId: recipient.userId,
        status: cycleNum === 1 ? 'collecting' : 'pending',
        dueDate,
      },
    });
  }

  // 6. Create escrow account for the group
  await tx.escrowAccount.create({
    data: { groupId },
  });

  // 7. Activate the group
  await tx.stokvelGroup.update({
    where: { id: groupId },
    data: { status: 'active', currentCycle: 1 },
  });

  logger.info(`Group ${groupId} activated with ${members.length} members`);

  // 8. Publish event (outside transaction — best effort)
  publish('stokvel.group.started', {
    groupId,
    tier,
    memberIds: members.map(m => m.userId),
    swapWindowExpiresAt: swapExpiry.toISOString(),
  }).catch(err => logger.warn('Failed to publish group.started event:', err.message));
}

module.exports = { getPoolStatus, joinPool, leavePool };
