const cron    = require('node-cron');
const prisma  = require('../../../../shared/config/database');
const logger  = require('../../../../shared/config/logger');
const { publish } = require('../../../../shared/config/rabbitmq');
const { getTierAmount, splitContribution } = require('../../../../shared/utils/money');
const { handleDropout } = require('../controllers/cycle.controller');

let warningJob = null;
let processJob = null;
let expireJob  = null;

function start() {
  // Daily 08:00 — warn members with low balance
  warningJob = cron.schedule('0 8 * * *', checkAndWarn, {
    timezone: 'Africa/Johannesburg',
  });

  // Daily 09:00 — process contributions on cycle day
  processJob = cron.schedule('0 9 * * *', processContributions, {
    timezone: 'Africa/Johannesburg',
  });

  // Daily 10:00 — cancel expired forming groups
  expireJob = cron.schedule('0 10 * * *', cancelExpiredGroups, {
    timezone: 'Africa/Johannesburg',
  });

  logger.info('Cycle cron jobs started');
}

function stop() {
  warningJob?.stop();
  processJob?.stop();
  expireJob?.stop();
  logger.info('Cycle cron jobs stopped');
}

async function checkAndWarn() {
  logger.info('CRON: Checking member balances...');
  try {
    const now    = new Date();
    const in5Days = new Date(now);
    in5Days.setDate(in5Days.getDate() + 5);

    const upcomingCycles = await prisma.stokvelCycle.findMany({
      where: {
        status:  'collecting',
        dueDate: { lte: in5Days, gte: now },
      },
      include: {
        group: { include: { members: { where: { status: 'active' } } } },
      },
    });

    for (const cycle of upcomingCycles) {
      const required = getTierAmount(cycle.group.tier);

      for (const member of cycle.group.members) {
        const account = await prisma.account.findUnique({
          where: { userId: member.userId },
        });

        if (!account || account.balance < required) {
          const daysLeft = Math.ceil((new Date(cycle.dueDate) - now) / (1000 * 60 * 60 * 24));
          logger.warn(`Low balance warning: member ${member.userId} — ${daysLeft} days until cycle`);

          publish('stokvel.contribution.warning', {
            userId:      member.userId,
            groupId:     cycle.groupId,
            cycleId:     cycle.id,
            balance:     account?.balance || 0,
            required,
            daysUntilDue: daysLeft,
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    logger.error('CRON checkAndWarn error: ' + err.message);
  }
}

async function processContributions() {
  logger.info('CRON: Processing contributions...');
  try {
    const now          = new Date();
    const startOfDay   = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay     = new Date(now.setHours(23, 59, 59, 999));

    const dueCycles = await prisma.stokvelCycle.findMany({
      where: {
        status:  'collecting',
        dueDate: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        group: { include: { members: true, escrow: true } },
      },
    });

    for (const cycle of dueCycles) {
      logger.info(`Processing cycle ${cycle.id} for group ${cycle.groupId}`);
      await _processCycleContributions(cycle);
    }
  } catch (err) {
    logger.error('CRON processContributions error: ' + err.message);
  }
}

async function _processCycleContributions(cycle) {
  const tier    = cycle.group.tier;
  const amount  = getTierAmount(tier);
  const { toPot } = splitContribution(amount);

  await prisma.$transaction(async (tx) => {
    let suspendedCount = 0;

    for (const member of cycle.group.members) {
      if (member.status !== 'active') continue;

      // Check if already contributed
      const alreadyPaid = await tx.stokvelContribution.findFirst({
        where: { cycleId: cycle.id, userId: member.userId, status: 'paid' },
      });
      if (alreadyPaid) continue;

      const account = await tx.account.findUnique({ where: { userId: member.userId } });

      if (account && account.balance >= amount) {
        // Auto-deduct contribution
        const { platformFee } = splitContribution(amount);

        await tx.account.update({
          where: { userId: member.userId },
          data:  { balance: { decrement: amount } },
        });

        await tx.stokvelContribution.create({
          data: {
            cycleId:  cycle.id,
            groupId:  cycle.groupId,
            userId:   member.userId,
            memberId: member.id,
            amount:   toPot,
            type:     'contribution',
            status:   'paid',
            paidAt:   new Date(),
          },
        });

        await tx.escrowAccount.update({
          where: { groupId: cycle.groupId },
          data:  { platformFees: { increment: platformFee } },
        });

      } else {
        // Insufficient balance — handle dropout
        suspendedCount++;
        const result = await handleDropout(
          tx,
          cycle.groupId,
          member.userId,
          cycle.id,
          tier
        );

        if (!result.covered) {
          logger.error(`Group ${cycle.groupId} suspended — cannot cover dropout`);
          return; // Stop processing
        }
      }
    }

    // Check if all paid and process payout
    const paidCount = await tx.stokvelContribution.count({
      where: {
        cycleId: cycle.id,
        type:    'contribution',
        status:  { in: ['paid', 'covered_by_backup'] },
      },
    });

    if (paidCount >= 3) {
      const totalPot = toPot * 3;

      await tx.account.update({
        where: { userId: cycle.recipientId },
        data:  { balance: { increment: totalPot } },
      });

      await tx.stokvelCycle.update({
        where: { id: cycle.id },
        data:  { status: 'paid', paidAt: new Date(), totalPot },
      });

      logger.info(`Cron payout: R${totalPot / 100} to ${cycle.recipientId}`);
    }
  });
}

async function cancelExpiredGroups() {
  logger.info('CRON: Checking for expired forming groups...');
  try {
    const now     = new Date();
    const expired = await prisma.stokvelGroup.findMany({
      where: { status: 'forming', expiresAt: { lte: now } },
      include: { members: true },
    });

    for (const group of expired) {
      await prisma.stokvelGroup.update({
        where: { id: group.id },
        data:  { status: 'cancelled' },
      });

      for (const member of group.members) {
        publish('stokvel.group.cancelled', {
          groupId: group.id,
          userId:  member.userId,
          tier:    group.tier,
          reason:  'Group did not fill within 7 days',
        }).catch(() => {});
      }

      logger.info(`Expired group ${group.id} cancelled`);
    }
  } catch (err) {
    logger.error('CRON cancelExpiredGroups error: ' + err.message);
  }
}

module.exports = { start, stop };
