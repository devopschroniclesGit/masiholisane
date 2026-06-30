const prisma = require('../../../../shared/config/database');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');

async function getMyGroups(req, res, next) {
  try {
    const members = await prisma.stokvelMember.findMany({
      where: { userId: req.user.id },
      include: {
        group: {
          include: {
            cycles: { orderBy: { cycleNumber: 'asc' } },
            members: { include: { user: { select: { name: true, email: true } } } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    return sendSuccess(res, { groups: members });
  } catch (err) { next(err); }
}

async function getGroup(req, res, next) {
  try {
    const group = await prisma.stokvelGroup.findUnique({
      where: { id: req.params.groupId },
      include: {
        members: { include: { user: { select: { name: true } } } },
        cycles: { orderBy: { cycleNumber: 'asc' } },
        escrow: true,
      },
    });
    if (!group) return sendError(res, 404, 'Group not found');

    const isMember = group.members.some(m => m.userId === req.user.id);
    if (!isMember) return sendError(res, 403, 'You are not a member of this group');

    return sendSuccess(res, { group });
  } catch (err) { next(err); }
}

async function getGroupMembers(req, res, next) {
  try {
    const members = await prisma.stokvelMember.findMany({
      where: { groupId: req.params.groupId },
      include: { user: { select: { name: true, email: true } } },
    });
    return sendSuccess(res, { members });
  } catch (err) { next(err); }
}

async function requestSwap(req, res, next) {
  try {
    const { targetMemberId } = req.body;
    const { groupId } = req.params;

    const group = await prisma.stokvelGroup.findUnique({ where: { id: groupId } });
    if (!group) return sendError(res, 404, 'Group not found');
    if (group.status !== 'active') return sendError(res, 400, 'Group is not active');

    const firstCycle = await prisma.stokvelCycle.findFirst({
      where: { groupId, cycleNumber: 1 },
    });
    if (!firstCycle) return sendError(res, 400, 'Cycle not found');

    const swapWindow = new Date(group.createdAt);
    swapWindow.setHours(swapWindow.getHours() + 24);
    if (new Date() > swapWindow) {
      return sendError(res, 400, 'Swap window has closed (24 hours after group formed)');
    }

    const initiator = await prisma.stokvelMember.findFirst({
      where: { groupId, userId: req.user.id },
    });
    if (!initiator) return sendError(res, 403, 'You are not in this group');

    const swap = await prisma.positionSwap.create({
      data: {
        groupId,
        initiatorId: initiator.id,
        receiverId: targetMemberId,
        expiresAt: swapWindow,
        status: 'pending',
      },
    });
    return sendSuccess(res, { swap }, 'Swap request sent', 201);
  } catch (err) { next(err); }
}

async function acceptSwap(req, res, next) {
  try {
    const { groupId, swapId } = req.params;

    const swap = await prisma.positionSwap.findUnique({
      where: { id: swapId },
      include: { initiator: true, receiver: true },
    });

    if (!swap) return sendError(res, 404, 'Swap request not found');
    if (swap.status !== 'pending') return sendError(res, 400, 'Swap is no longer pending');
    if (new Date() > swap.expiresAt) return sendError(res, 400, 'Swap window expired');
    if (swap.receiver.userId !== req.user.id) return sendError(res, 403, 'Not your swap to accept');

    await prisma.$transaction(async (tx) => {
      const initPos = swap.initiator.position;
      const recvPos = swap.receiver.position;

      await tx.stokvelMember.update({ where: { id: swap.initiatorId }, data: { position: recvPos } });
      await tx.stokvelMember.update({ where: { id: swap.receiverId },  data: { position: initPos } });
      await tx.positionSwap.update({ where: { id: swapId }, data: { status: 'accepted' } });

      await tx.stokvelCycle.updateMany({
        where: { groupId, cycleNumber: recvPos },
        data: { recipientId: swap.initiator.userId },
      });
      await tx.stokvelCycle.updateMany({
        where: { groupId, cycleNumber: initPos },
        data: { recipientId: swap.receiver.userId },
      });
    });

    return sendSuccess(res, null, 'Swap accepted positions updated');
  } catch (err) { next(err); }
}

async function rejectSwap(req, res, next) {
  try {
    const swap = await prisma.positionSwap.findUnique({ where: { id: req.params.swapId } });
    if (!swap) return sendError(res, 404, 'Swap not found');
    if (swap.receiver.userId !== req.user.id) return sendError(res, 403, 'Not your swap to reject');

    await prisma.positionSwap.update({ where: { id: req.params.swapId }, data: { status: 'rejected' } });
    return sendSuccess(res, null, 'Swap rejected');
  } catch (err) { next(err); }
}

module.exports = { getMyGroups, getGroup, getGroupMembers, requestSwap, acceptSwap, rejectSwap };
