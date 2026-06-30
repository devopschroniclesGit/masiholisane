const prisma = require('../../../../shared/config/database');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');

async function getBalance(req, res, next) {
  try {
    const userId  = req.user.id;

    const account = await prisma.account.findUnique({ where: { userId } });
    if (!account) return sendError(res, 404, 'Wallet not found');

    // Get all forming/active groups for the user
    const memberships = await prisma.stokvelMember.findMany({
      where: {
        userId,
        status: { in: ['active', 'suspended'] },
        group:  { status: { in: ['forming', 'active'] } },
      },
      include: {
        group: {
          include: { escrow: true },
        },
      },
    });

    // Sum up reservation amounts held per group (first cycle contribution)
    const TIER_AMOUNTS = { 1: 50000, 2: 100000, 3: 200000 }; // cents
    const heldBreakdown = memberships.map(m => ({
      groupId:   m.group.id,
      tier:      m.group.tier,
      tierLabel: { 1: 'Starter', 2: 'Builder', 3: 'Wealth' }[m.group.tier],
      amount:    m.group.status === 'forming' ? (TIER_AMOUNTS[m.group.tier] || 0) : 0,
      status:    m.group.status,
      formatted: `R${((m.group.status === 'forming' ? TIER_AMOUNTS[m.group.tier] : 0) / 100).toFixed(2)}`,
      label:     m.group.status === 'forming' ? 'First cycle locked in' : 'Active',
    })).filter(h => h.amount > 0);

    const totalHeld = heldBreakdown.reduce((sum, h) => sum + h.amount, 0);
    const totalBalance = account.balance + totalHeld;

    // Recent transactions with optional date filter
    const days = parseInt(req.query.days);
    const dateFilter = (days && days > 0)
      ? { createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }
      : {};

    const recentTransactions = await prisma.transaction.findMany({
      where: {
        AND: [
          { OR: [{ fromAccountId: account.id }, { toAccountId: account.id }] },
          dateFilter,
        ],
      },
      orderBy: { createdAt: 'desc' },
      take:    100,
    });

    const bonusBalance = account.bonusBalance || 0;
    return sendSuccess(res, {
      available:          account.balance,
      availableFormatted: `R${(account.balance / 100).toFixed(2)}`,
      bonus:              bonusBalance,
      bonusFormatted:     `R${(bonusBalance / 100).toFixed(2)}`,
      held:               totalHeld,
      heldFormatted:      `R${(totalHeld / 100).toFixed(2)}`,
      total:              totalBalance + bonusBalance,
      totalFormatted:     `R${((totalBalance + bonusBalance) / 100).toFixed(2)}`,
      heldBreakdown,
      recentTransactions,
    });
  } catch (err) { next(err); }
}

async function getTransactions(req, res, next) {
  try {
    const userId  = req.user.id;

    const account = await prisma.account.findUnique({ where: { userId } });
    if (!account) return sendError(res, 404, 'Wallet not found');

    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { fromAccountId: account.id },
          { toAccountId:   account.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take:    50,
    });

    return sendSuccess(res, { transactions });
  } catch (err) { next(err); }
}

async function withdraw(req, res, next) {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount < 5000) {
      return sendError(res, 400, 'Minimum withdrawal is R50.00');
    }

    const account = await prisma.account.findUnique({ where: { userId } });
    if (!account) return sendError(res, 404, 'Wallet not found');

    if (account.balance < amount) {
      return sendError(res, 400, `Insufficient balance. Available: R${(account.balance / 100).toFixed(2)}`);
    }

    const fee = Math.floor(amount * 0.02);
    const netToBank = amount - fee;

    await prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { userId },
        data:  { balance: { decrement: amount } },
      });

      await tx.transaction.create({
        data: {
          fromAccountId:  account.id,
          amount:         amount,
          type:           'withdrawal',
          status:         'pending', // Will be 'completed' when bank confirms
          idempotencyKey: `withdraw-${userId}-${Date.now()}`,
          description:    `Withdrawal to bank R${(netToBank / 100).toFixed(2)}`,
        },
      });

      await tx.transaction.create({
        data: {
          fromAccountId:  account.id,
          amount:         fee,
          type:           'fee',
          status:         'completed',
          idempotencyKey: `withdrawal-fee-${userId}-${Date.now()}`,
          description:    `Withdrawal fee (2%)`,
        },
      });
    });

    return sendSuccess(res, {
      requested:   amount,
      fee,
      netToBank,
      formatted:   {
        requested: `R${(amount / 100).toFixed(2)}`,
        fee:       `R${(fee / 100).toFixed(2)}`,
        netToBank: `R${(netToBank / 100).toFixed(2)}`,
      },
    }, 'Withdrawal initiated. Funds arrive in 1-2 business days.');
  } catch (err) { next(err); }
}

module.exports = { getBalance, getTransactions, withdraw };
