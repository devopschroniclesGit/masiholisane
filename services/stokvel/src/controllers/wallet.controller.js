const prisma = require('../../../../shared/config/database');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');

async function getBalance(req, res, next) {
  try {
    const userId  = req.user.id;

    const account = await prisma.account.findUnique({
      where: { userId },
    });

    if (!account) {
      return sendError(res, 404, 'Wallet not found');
    }

    // Get locked amount — contributions locked for active cycles
    const activeMemberships = await prisma.stokvelMember.findMany({
      where: {
        userId,
        status: 'active',
        group:  { status: 'active' },
      },
      include: {
        group: { include: { cycles: { where: { status: 'collecting' } } } },
      },
    });

    // Check security deposits in escrow
    const escrowAccounts = await prisma.escrowTransaction.findMany({
      where: {
        userId,
        type:      'security_deposit',
        direction: 'in',
      },
      include: {
        escrow: {
          include: {
            group: { select: { status: true } },
          },
        },
      },
    });

    const lockedDeposits = escrowAccounts
      .filter(et => ['active', 'forming'].includes(et.escrow?.group?.status))
      .reduce((sum, et) => sum + et.amount, 0);

    // Recent transactions
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { fromAccountId: account.id },
          { toAccountId:   account.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take:    10,
    });

    return sendSuccess(res, {
      balance:          account.balance,
      balanceFormatted: `R${(account.balance / 100).toFixed(2)}`,
      lockedDeposits,
      lockedFormatted:  `R${(lockedDeposits / 100).toFixed(2)}`,
      available:        account.balance,
      availableFormatted: `R${(account.balance / 100).toFixed(2)}`,
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

module.exports = { getBalance, getTransactions };
