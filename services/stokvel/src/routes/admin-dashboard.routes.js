const express = require('express');
const prisma  = require('../../../../shared/config/database');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');
const { requireAdmin } = require('./admin-auth.routes');

const router = express.Router();
router.use(requireAdmin);

// GET /admin/dashboard/overview
router.get('/overview', async (req, res, next) => {
  try {
    const [
      totalMembers,
      activeGroups,
      formingGroups,
      completedGroups,
      totalEscrow,
      recentRegistrations,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.stokvelGroup.count({ where: { status: 'active' } }),
      prisma.stokvelGroup.count({ where: { status: 'forming' } }),
      prisma.stokvelGroup.count({ where: { status: 'completed' } }),
      prisma.escrowAccount.aggregate({ _sum: { platformFees: true, securityFund: true } }),
      prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    const contributions = await prisma.stokvelContribution.aggregate({
      where:  { status: 'paid' },
      _sum:   { amount: true },
      _count: true,
    });

    const payouts = await prisma.stokvelCycle.aggregate({
      where:  { status: 'paid' },
      _sum:   { totalPot: true },
      _count: true,
    });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyContributions = await prisma.stokvelContribution.findMany({
      where:  { status: 'paid', createdAt: { gte: sixMonthsAgo } },
      select: { amount: true, createdAt: true },
    });

    const revenueByMonth = {};
    monthlyContributions.forEach(c => {
      const month = c.createdAt.toISOString().slice(0, 7);
      revenueByMonth[month] = (revenueByMonth[month] || 0) + Math.floor(c.amount * 2 / 98);
    });

    return sendSuccess(res, {
      members:   { total: totalMembers, newThisWeek: recentRegistrations },
      groups:    { active: activeGroups, forming: formingGroups, completed: completedGroups },
      financial: {
        totalContributions:     contributions._sum.amount || 0,
        totalContributionCount: contributions._count,
        totalPayouts:           payouts._sum.totalPot || 0,
        totalPayoutCount:       payouts._count,
        platformFeesCollected:  totalEscrow._sum.platformFees || 0,
        securityDepositsHeld:   totalEscrow._sum.securityFund || 0,
        revenueByMonth,
      },
    });
  } catch (err) { next(err); }
});

// GET /admin/dashboard/members
router.get('/members', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (search) {
      where.OR = [
        { name:  { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take:    parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true,
          verified: true, createdAt: true,
          account:    { select: { balance: true } },
          trustScore: { select: { score: true, tier: true } },
          stokvelMembers: {
            select: { status: true, group: { select: { status: true, tier: true } } },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return sendSuccess(res, { users, total, page: parseInt(page) });
  } catch (err) { next(err); }
});

// GET /admin/dashboard/groups
router.get('/groups', async (req, res, next) => {
  try {
    const { status, tier } = req.query;
    const where = {};
    if (status) where.status = status;
    if (tier)   where.tier   = parseInt(tier);

    const groups = await prisma.stokvelGroup.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        members: { include: { user: { select: { name: true, email: true } } } },
        cycles:  true,
        escrow:  true,
      },
    });

    return sendSuccess(res, { groups, total: groups.length });
  } catch (err) { next(err); }
});

// POST /admin/dashboard/test-funds
router.post('/test-funds', async (req, res, next) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount || amount <= 0) {
      return sendError(res, 400, 'userId and amount in Rands required');
    }
    if (amount > 10000) {
      return sendError(res, 400, 'Maximum R10,000 per transaction');
    }

    const amountCents = Math.round(amount * 100);
    const account     = await prisma.account.findUnique({ where: { userId } });
    if (!account) return sendError(res, 404, 'Wallet not found');

    const updated = await prisma.account.update({
      where: { userId },
      data:  { bonusBalance: { increment: amountCents } },
    });

    await prisma.transaction.create({
      data: {
        toAccountId:    account.id,
        amount:         amountCents,
        type:           'bonus',
        status:         'completed',
        idempotencyKey: `bonus-funds-${userId}-${Date.now()}`,
        description:    `Bonus credit added by admin R${amount} (VAS only)`,
      },
    });

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId:   req.admin.adminId,
        action:    'add_bonus_funds',
        targetId:  userId,
        details:   { amount, amountCents, newBalance: updated.balance, addedBy: req.admin.email },
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, {
      userId,
      amountAdded:         amountCents,
      newBalance:          updated.balance,
      newBalanceFormatted: `R${(updated.balance / 100).toFixed(2)}`,
    }, `R${amount} test funds added`);
  } catch (err) { next(err); }
});

// GET /admin/dashboard/reports/revenue
router.get('/reports/revenue', async (req, res, next) => {
  try {
    const contributions = await prisma.stokvelContribution.findMany({
      where:   { status: 'paid' },
      select:  { amount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const cycles = await prisma.stokvelCycle.findMany({
      where:   { status: 'paid' },
      select:  { totalPot: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    });

    const escrow = await prisma.escrowAccount.aggregate({
      _sum: { platformFees: true, securityFund: true },
    });

    const monthly = {};
    contributions.forEach(c => {
      const month = c.createdAt.toISOString().slice(0, 7);
      if (!monthly[month]) monthly[month] = { contributions: 0, fees: 0, payouts: 0 };
      monthly[month].contributions += c.amount;
      monthly[month].fees += Math.floor(c.amount * 2 / 98);
    });

    cycles.forEach(c => {
      if (!c.paidAt) return;
      const month = c.paidAt.toISOString().slice(0, 7);
      if (!monthly[month]) monthly[month] = { contributions: 0, fees: 0, payouts: 0 };
      monthly[month].payouts += c.totalPot;
    });

    return sendSuccess(res, {
      summary: {
        totalContributions:    contributions.reduce((s, c) => s + c.amount, 0),
        totalPayouts:          cycles.reduce((s, c) => s + c.totalPot, 0),
        platformFeesCollected: escrow._sum.platformFees || 0,
        securityDepositsHeld:  escrow._sum.securityFund || 0,
      },
      monthly,
    });
  } catch (err) { next(err); }
});

// GET /admin/dashboard/audit
router.get('/audit', async (req, res, next) => {
  try {
    const logs = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take:    100,
    });
    return sendSuccess(res, { logs });
  } catch (err) { next(err); }
});

module.exports = router;

// POST /admin/dashboard/groups/:groupId/remove-member
router.post('/groups/:groupId/remove-member', async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { userId, reason } = req.body;

    if (!userId) return sendError(res, 400, 'userId required');

    const membership = await prisma.stokvelMember.findFirst({
      where:   { groupId, userId },
      include: { group: { include: { members: true, escrow: true } } },
    });
    if (!membership) return sendError(res, 404, 'Member not found in this group');

    if (membership.group.status === 'completed') {
      return sendError(res, 400, 'Cannot modify a completed group');
    }
    if (membership.group.status === 'cancelled') {
      return sendError(res, 400, 'Group is already cancelled');
    }

    const refundedMembers = [];

    await prisma.$transaction(async (tx) => {

      // ─── CASE 1: FORMING GROUP ──────────────────────────────────────────
      // No deposits taken yet, just remove the member
      if (membership.group.status === 'forming') {
        await tx.stokvelMember.delete({ where: { id: membership.id } });

        // Delete empty forming group
        const remaining = await tx.stokvelMember.count({ where: { groupId } });
        if (remaining === 0) {
          await tx.stokvelGroup.delete({ where: { id: groupId } });
        }
        return;
      }

      // ─── CASE 2: ACTIVE GROUP ───────────────────────────────────────────
      // Cancel entire group, refund ALL members their deposits and contributions

      // Refund all members the contributions they made
      for (const member of membership.group.members) {
        const memberAccount = await tx.account.findUnique({ where: { userId: member.userId } });
        if (!memberAccount) continue;

        // Refund any contributions they made in this group (full amount, no fee was taken)
        const contributions = await tx.stokvelContribution.findMany({
          where: { groupId, userId: member.userId, status: 'paid', type: 'contribution' },
        });

        let totalRefunded = 0;
        for (const contribution of contributions) {
          await tx.account.update({
            where: { userId: member.userId },
            data:  { balance: { increment: contribution.amount } },
          });

          await tx.transaction.create({
            data: {
              toAccountId:    memberAccount.id,
              amount:         contribution.amount,
              type:           'refund',
              status:         'completed',
              idempotencyKey: `refund-contrib-${contribution.id}`,
              description:    `Contribution refunded — Group cancelled by admin`,
            },
          });

          await tx.stokvelContribution.update({
            where: { id: contribution.id },
            data:  { status: 'refunded' },
          });
          totalRefunded += contribution.amount;
        }

        refundedMembers.push({
          userId:    member.userId,
          refunded:  totalRefunded,
          formatted: `R${(totalRefunded / 100).toFixed(2)}`,
        });

        await tx.stokvelMember.update({
          where: { id: member.id },
          data:  { status: 'completed' },
        });
      }

      // Reset escrow account
      if (membership.group.escrow) {
        await tx.escrowAccount.update({
          where: { groupId },
          data:  { securityFund: 0, released: true },
        });
      }

      // Cancel the group
      await tx.stokvelGroup.update({
        where: { id: groupId },
        data:  { status: 'cancelled' },
      });
    });

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId:   req.admin.adminId,
        action:    membership.group.status === 'forming'
                     ? 'remove_member_forming'
                     : 'cancel_active_group',
        targetId:  userId,
        details: {
          groupId,
          reason,
          groupTier:   membership.group.tier,
          groupStatus: membership.group.status,
          removedBy:   req.admin.email,
          refundedMembers,
        },
        ipAddress: req.ip,
      },
    });

    const message = membership.group.status === 'forming'
      ? 'Member removed from forming group'
      : `Group cancelled. ${refundedMembers.length} members refunded.`;

    return sendSuccess(res, {
      groupId,
      userId,
      groupCancelled: membership.group.status === 'active',
      refundedMembers,
    }, message);

  } catch (err) { next(err); }
});

// GET /admin/dashboard/promos — list all promo codes
router.get('/promos', async (req, res, next) => {
  try {
    const promos = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    });
    return sendSuccess(res, { promos });
  } catch (err) { next(err); }
});

// POST /admin/dashboard/promos — create new code
router.post('/promos', async (req, res, next) => {
  try {
    const { code, amount, maxUses, expiresInDays, description } = req.body;
    if (!code || !amount) return sendError(res, 400, 'Code and amount required');

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // default 30 days

    const promo = await prisma.promoCode.create({
      data: {
        code:      code.toUpperCase().trim(),
        amount:    parseInt(amount),
        maxUses:   parseInt(maxUses) || 100,
        expiresAt,
        description,
        createdBy: req.admin.adminId,
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId:   req.admin.adminId,
        action:    'create_promo_code',
        targetId:  promo.id,
        details:   { code: promo.code, amount, maxUses },
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, { promo }, 'Promo code created');
  } catch (err) {
    if (err.code === 'P2002') return sendError(res, 409, 'Code already exists');
    next(err);
  }
});

// GET /admin/dashboard/promos/:id/redemptions
router.get('/promos/:id/redemptions', async (req, res, next) => {
  try {
    const redemptions = await prisma.promoCodeRedemption.findMany({
      where:   { promoCodeId: req.params.id },
      include: { promoCode: true },
      orderBy: { redeemedAt: 'desc' },
    });

    // Hydrate user info separately
    const userIds = [...new Set(redemptions.map(r => r.userId))];
    const users = await prisma.user.findMany({
      where:  { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const enriched = redemptions.map(r => ({
      ...r,
      user: userMap[r.userId] || null,
    }));

    return sendSuccess(res, { redemptions: enriched });
  } catch (err) { next(err); }
});

// PATCH /admin/dashboard/promos/:id — deactivate code
router.patch('/promos/:id', async (req, res, next) => {
  try {
    const { active } = req.body;
    const promo = await prisma.promoCode.update({
      where: { id: req.params.id },
      data:  { active },
    });
    return sendSuccess(res, { promo }, active ? 'Code activated' : 'Code deactivated');
  } catch (err) { next(err); }
});
