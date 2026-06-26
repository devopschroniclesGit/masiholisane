const express = require('express');
const prisma  = require('../../../../shared/config/database');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');
const { requireAdmin } = require('./admin-auth.routes');

const router = express.Router();
router.use(requireAdmin);

// Overview
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
      where: { status: 'paid' },
      _sum:  { amount: true },
      _count: true,
    });

    const payouts = await prisma.stokvelCycle.aggregate({
      where: { status: 'paid' },
      _sum:  { totalPot: true },
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
      revenueByMonth[month] = (revenueByMonth[month] || 0) +
        Math.floor(c.amount * 2 / 98);
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

// Members list
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

// Groups list
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

// Add test funds
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
      data:  { balance: { increment: amountCents } },
    });

    await prisma.transaction.create({
      data: {
        toAccountId:    account.id,
        amount:         amountCents,
        type:           'deposit',
        status:         'completed',
        idempotencyKey: `test-funds-${userId}-${Date.now()}`,
        description:    `Test funds added by admin — R${amount}`,
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

// Revenue report
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

module.exports = router;
