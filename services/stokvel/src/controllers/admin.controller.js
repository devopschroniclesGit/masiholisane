const prisma = require('../../../../shared/config/database');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');

async function listGroups(req, res, next) {
  try {
    const { status, tier } = req.query;
    const where = {};
    if (status) where.status = status;
    if (tier) where.tier = parseInt(tier);

    const groups = await prisma.stokvelGroup.findMany({
      where,
      include: { members: true, cycles: true },
      orderBy: { createdAt: 'desc' },
    });
    return sendSuccess(res, { groups, total: groups.length });
  } catch (err) { next(err); }
}

async function getGroupDetail(req, res, next) {
  try {
    const group = await prisma.stokvelGroup.findUnique({
      where: { id: req.params.groupId },
      include: {
        members: { include: { user: { select: { name: true, email: true } } } },
        cycles: { include: { contributions: true } },
        escrow: true,
      },
    });
    if (!group) return sendError(res, 404, 'Group not found');
    return sendSuccess(res, { group });
  } catch (err) { next(err); }
}

async function triggerPayout(req, res, next) {
  try {
    const cycle = await prisma.stokvelCycle.findUnique({ where: { id: req.params.cycleId } });
    if (!cycle) return sendError(res, 404, 'Cycle not found');
    if (cycle.status === 'paid') return sendError(res, 400, 'Cycle already paid');
    return sendSuccess(res, null, 'Manual payout triggered — implement full payout logic here');
  } catch (err) { next(err); }
}

async function suspendGroup(req, res, next) {
  try {
    const group = await prisma.stokvelGroup.update({
      where: { id: req.params.groupId },
      data: { status: 'suspended' },
    });
    return sendSuccess(res, { group }, 'Group suspended');
  } catch (err) { next(err); }
}

async function cancelGroup(req, res, next) {
  try {
    const group = await prisma.stokvelGroup.findUnique({ where: { id: req.params.groupId } });
    if (!group) return sendError(res, 404, 'Group not found');
    if (group.status === 'active') return sendError(res, 400, 'Cannot cancel an active group');

    await prisma.stokvelGroup.update({ where: { id: req.params.groupId }, data: { status: 'cancelled' } });
    return sendSuccess(res, null, 'Group cancelled');
  } catch (err) { next(err); }
}

module.exports = { listGroups, getGroupDetail, triggerPayout, suspendGroup, cancelGroup };
