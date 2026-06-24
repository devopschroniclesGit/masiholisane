const prisma = require('../../../../shared/config/database');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');
const { getTierAmount, splitContribution } = require('../../../../shared/utils/money');

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

    const member = await prisma.stokvelMember.findFirst({ where: { groupId, userId } });
    if (!member) return sendError(res, 403, 'You are not a member of this group');
    if (member.status === 'suspended') return sendError(res, 403, 'Your membership is suspended');

    const cycle = await prisma.stokvelCycle.findFirst({
      where: { groupId, status: 'collecting' },
    });
    if (!cycle) return sendError(res, 400, 'No active cycle to contribute to');

    const existing = await prisma.stokvelContribution.findFirst({
      where: { cycleId: cycle.id, userId, type: 'contribution', status: 'paid' },
    });
    if (existing) return sendError(res, 409, 'You have already contributed this cycle');

    const group = await prisma.stokvelGroup.findUnique({ where: { id: groupId } });
    const amount = getTierAmount(group.tier);
    const { platformFee, backupFund, toPot } = splitContribution(amount);

    const account = await prisma.account.findUnique({ where: { userId } });
    if (!account || account.balance < amount) {
      return sendError(res, 400, `Insufficient balance. Need R${amount / 100}, have R${(account?.balance || 0) / 100}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.account.update({ where: { userId }, data: { balance: { decrement: amount } } });

      await tx.stokvelContribution.create({
        data: { cycleId: cycle.id, groupId, userId, memberId: member.id, amount: toPot, type: 'contribution', status: 'paid', paidAt: new Date() },
      });

      await tx.escrowAccount.update({
        where: { groupId },
        data: { backupFund: { increment: backupFund }, platformFees: { increment: platformFee } },
      });

      const allPaid = await tx.stokvelContribution.count({
        where: { cycleId: cycle.id, type: 'contribution', status: { in: ['paid', 'covered_by_backup'] } },
      });

      if (allPaid >= 3) {
        const totalPot = toPot * 3;
        await tx.account.update({ where: { userId: cycle.recipientId }, data: { balance: { increment: totalPot } } });
        await tx.stokvelCycle.update({ where: { id: cycle.id }, data: { status: 'paid', paidAt: new Date(), totalPot } });

        if (cycle.cycleNumber < 3) {
          await tx.stokvelCycle.updateMany({
            where: { groupId, cycleNumber: cycle.cycleNumber + 1 },
            data: { status: 'collecting' },
          });
          await tx.stokvelGroup.update({ where: { id: groupId }, data: { currentCycle: cycle.cycleNumber + 1 } });
        } else {
          await tx.stokvelGroup.update({ where: { id: groupId }, data: { status: 'completed' } });
        }
      }
    });

    return sendSuccess(res, { contributed: amount, toPot, platformFee, backupFund }, 'Contribution successful');
  } catch (err) { next(err); }
}

module.exports = { getGroupCycles, getCurrentCycle, contribute };
