const express = require('express');
const path    = require('path');
const fs      = require('fs');
const prisma  = require('../../../../shared/config/database');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');
const { requireAdmin } = require('./admin-auth.routes');
const { UPLOAD_DIR } = require('../config/upload');

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

// GET /admin/dashboard/audit-logs — paginated, filterable audit trail
// (upgraded from the old unpaginated GET /audit, which nothing was calling yet)
router.get('/audit-logs', async (req, res, next) => {
  try {
    const { page = 1, limit = 25, action, adminId, from, to } = req.query;
    const where = {};
    if (action)  where.action  = action;
    if (adminId) where.adminId = adminId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    // adminId is a raw string with no Prisma relation, so hydrate name/email
    // separately, same pattern already used for promo redemptions below.
    const adminIds = [...new Set(logs.map(l => l.adminId))];
    const admins = await prisma.admin.findMany({
      where:  { id: { in: adminIds } },
      select: { id: true, name: true, email: true },
    });
    const adminMap = Object.fromEntries(admins.map(a => [a.id, a]));

    // targetId means different things for different actions, only resolve
    // it against the User table for actions where it's actually a userId.
    // (e.g. update_vas_fee's targetId is a product type string, not a user.)
    const USER_TARGET_ACTIONS = [
      'approve_id_verification', 'reject_id_verification',
      'remove_member_forming', 'cancel_active_group',
      'process_account_deletion', 'cancel_deletion_request',
    ];
    const targetUserIds = [...new Set(
      logs.filter(l => USER_TARGET_ACTIONS.includes(l.action)).map(l => l.targetId)
    )];
    const targetUsers = targetUserIds.length
      ? await prisma.user.findMany({
          where:  { id: { in: targetUserIds } },
          select: { id: true, name: true, email: true, phone: true },
        })
      : [];
    const targetUserMap = Object.fromEntries(targetUsers.map(u => [u.id, u]));

    const enriched = logs.map(l => ({
      ...l,
      admin:      adminMap[l.adminId] || null,
      targetUser: USER_TARGET_ACTIONS.includes(l.action) ? (targetUserMap[l.targetId] || null) : null,
    }));

    return sendSuccess(res, {
      logs: enriched,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
});

// GET /admin/dashboard/audit-logs/actions — distinct action types actually
// present in the table, so the filter dropdown never drifts from reality.
router.get('/audit-logs/actions', async (req, res, next) => {
  try {
    const rows = await prisma.adminAuditLog.findMany({
      select:   { action: true },
      distinct: ['action'],
      orderBy:  { action: 'asc' },
    });
    return sendSuccess(res, { actions: rows.map(r => r.action) });
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
      // Money WAS already taken at join time under the reservation model,
      // it's just not a StokvelContribution row yet (those only get created
      // when the group activates). The reservation only exists as a
      // Transaction with idempotencyKey `reserve-${groupId}-${userId}`, so
      // that's what has to be found and reversed here.
      if (membership.group.status === 'forming') {
        const account = await tx.account.findUnique({ where: { userId: membership.userId } });
        const reservation = await tx.transaction.findFirst({
          where: { idempotencyKey: `reserve-${groupId}-${membership.userId}` },
        });

        if (reservation && account) {
          await tx.account.update({
            where: { userId: membership.userId },
            data:  { balance: { increment: reservation.amount } },
          });
          await tx.transaction.create({
            data: {
              toAccountId:    account.id,
              amount:         reservation.amount,
              type:           'refund',
              status:         'completed',
              idempotencyKey: `admin-remove-refund-${groupId}-${membership.userId}`,
              description:    `Reservation refunded, removed from Tier ${membership.group.tier} group by admin`,
            },
          });
          refundedMembers.push({
            userId:    membership.userId,
            refunded:  reservation.amount,
            formatted: `R${(reservation.amount / 100).toFixed(2)}`,
          });
        }

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
              description:    `Contribution refunded, group cancelled by admin`,
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

function tierFromScore(score) {
  if (score >= 90) return 'elite';
  if (score >= 70) return 'good';
  if (score >= 50) return 'trusted';
  if (score >= 30) return 'new';
  return 'restricted';
}

// GET /admin/dashboard/id-verifications?status=pending
router.get('/id-verifications', async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const users = await prisma.user.findMany({
      where:  { idVerificationStatus: status },
      orderBy: { idSubmittedAt: 'asc' },
      select: {
        id: true, name: true, email: true, phone: true,
        idNumber: true, idDocumentPath: true,
        idVerificationStatus: true, idSubmittedAt: true,
        idReviewedAt: true, idReviewedBy: true, idRejectionReason: true,
      },
    });
    return sendSuccess(res, { users, total: users.length });
  } catch (err) { next(err); }
});

// GET /admin/dashboard/id-verifications/:userId/document
// Streams the uploaded ID photo. Filename is read from the DB record only —
// never trust a client-supplied path here, to avoid directory traversal.
router.get('/id-verifications/:userId/document', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.params.userId },
      select: { idDocumentPath: true },
    });
    if (!user?.idDocumentPath) return sendError(res, 404, 'No document on file');

    const safeName = path.basename(user.idDocumentPath);
    const fullPath = path.join(UPLOAD_DIR, safeName);

    if (!fs.existsSync(fullPath)) return sendError(res, 404, 'Document file not found on disk');

    return res.sendFile(fullPath);
  } catch (err) { next(err); }
});

// POST /admin/dashboard/id-verifications/:userId/approve
router.post('/id-verifications/:userId/approve', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return sendError(res, 404, 'User not found');
    if (user.idVerificationStatus !== 'pending') {
      return sendError(res, 409, `Cannot approve, current status is "${user.idVerificationStatus}"`);
    }

    const SCORE_DELTA = 10;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data:  {
          verified:             true,
          idVerificationStatus: 'approved',
          idReviewedAt:         new Date(),
          idReviewedBy:         req.admin.adminId,
        },
      });

      let trust = await tx.trustScore.findUnique({ where: { userId } });
      const before = trust?.score || 0;
      const after  = Math.min(100, before + SCORE_DELTA);

      if (trust) {
        trust = await tx.trustScore.update({
          where: { userId },
          data:  { score: after, tier: tierFromScore(after) },
        });
      } else {
        trust = await tx.trustScore.create({
          data: { userId, score: after, tier: tierFromScore(after) },
        });
      }

      await tx.trustScoreEvent.create({
        data: {
          userId,
          scoreId:     trust.id,
          event:       'id_verified',
          delta:       SCORE_DELTA,
          scoreBefore: before,
          scoreAfter:  after,
          reason:      `ID approved by admin (${req.admin.email})`,
        },
      });
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId:   req.admin.adminId,
        action:    'approve_id_verification',
        targetId:  userId,
        details:   { approvedBy: req.admin.email },
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, { userId, verified: true }, 'ID approved. Deposits and joining pools are now unlocked for this member.');
  } catch (err) { next(err); }
});

// POST /admin/dashboard/id-verifications/:userId/reject
router.post('/id-verifications/:userId/reject', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    if (!reason) return sendError(res, 400, 'A rejection reason is required');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return sendError(res, 404, 'User not found');
    if (user.idVerificationStatus !== 'pending') {
      return sendError(res, 409, `Cannot reject, current status is "${user.idVerificationStatus}"`);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        idVerificationStatus: 'rejected',
        idRejectionReason:    reason,
        idReviewedAt:         new Date(),
        idReviewedBy:         req.admin.adminId,
        idNumber:             null, // release the ID number so the member can resubmit
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId:   req.admin.adminId,
        action:    'reject_id_verification',
        targetId:  userId,
        details:   { reason, rejectedBy: req.admin.email },
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, { userId, status: 'rejected' }, 'Submission rejected. The member can resubmit.');
  } catch (err) { next(err); }
});

// ── VAS Fee Config ───────────────────────────────────────────────────────────

// GET /admin/dashboard/vas-fees
router.get('/vas-fees', async (req, res, next) => {
  try {
    const DEFAULTS = { airtime: 3, data: 3, electricity: 0 };
    const configs = await prisma.vasFeeConfig.findMany();
    const configMap = Object.fromEntries(configs.map(c => [c.productType, c]));

    const result = Object.keys(DEFAULTS).map((productType) => ({
      productType,
      feePercent: configMap[productType]?.feePercent ?? DEFAULTS[productType],
      isDefault:  !configMap[productType],
      updatedAt:  configMap[productType]?.updatedAt || null,
    }));

    return sendSuccess(res, { fees: result });
  } catch (err) { next(err); }
});

// PUT /admin/dashboard/vas-fees/:productType
router.put('/vas-fees/:productType', async (req, res, next) => {
  try {
    const { productType } = req.params;
    const { feePercent } = req.body;

    if (!['airtime', 'data', 'electricity'].includes(productType)) {
      return sendError(res, 400, 'Unknown product type');
    }
    if (feePercent === undefined || feePercent < 0 || feePercent > 50) {
      return sendError(res, 400, 'Fee percent must be between 0 and 50');
    }

    const config = await prisma.vasFeeConfig.upsert({
      where:  { productType },
      update: { feePercent, updatedBy: req.admin.adminId },
      create: { productType, feePercent, updatedBy: req.admin.adminId },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId:   req.admin.adminId,
        action:    'update_vas_fee',
        targetId:  productType,
        details:   { productType, feePercent, updatedBy: req.admin.email },
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, { config }, `${productType} fee set to ${feePercent}%`);
  } catch (err) { next(err); }
});

// ── Account Deletion Processing ──────────────────────────────────────────────

// GET /admin/dashboard/deletion-requests
// Only shows requests not yet processed. Includes enough about each user's
// group memberships and balance for the admin UI to warn before processing.
router.get('/deletion-requests', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where:   { deletionRequestedAt: { not: null }, deletedAt: null },
      orderBy: { deletionRequestedAt: 'asc' },
      select: {
        id: true, name: true, email: true, phone: true, deletionRequestedAt: true,
        account:        { select: { balance: true, bonusBalance: true } },
        stokvelMembers: { select: { status: true, group: { select: { status: true, tier: true } } } },
      },
    });
    return sendSuccess(res, { users, total: users.length });
  } catch (err) { next(err); }
});

// POST /admin/dashboard/deletion-requests/:userId/process
// Anonymizes and deactivates the account rather than deleting the row, so
// financial history stays intact for other members' group records and for
// recordkeeping obligations. Confirmed with the founder: allowed even with
// an active group or outstanding balance, as long as the admin has seen the
// warning first — the warning itself is computed client-side from the list
// endpoint's data, this endpoint just performs the action once confirmed.
router.post('/deletion-requests/:userId/process', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) return sendError(res, 404, 'User not found');
    if (!user.deletionRequestedAt) return sendError(res, 409, 'No deletion request on file for this user');
    if (user.deletedAt) return sendError(res, 409, 'This account has already been processed');

    await prisma.user.update({
      where: { id: userId },
      data: {
        name:           'Deleted User',
        email:          null,
        phone:          null,
        idNumber:       null,
        idDocumentPath: null,
        deletedAt:      new Date(),
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId:   req.admin.adminId,
        action:    'process_account_deletion',
        targetId:  userId,
        details:   { processedBy: req.admin.email },
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, { userId, deleted: true }, 'Account anonymized and deactivated.');
  } catch (err) { next(err); }
});

// POST /admin/dashboard/deletion-requests/:userId/cancel
// Declines the request without touching the account at all, just clears
// deletionRequestedAt so it drops off this list. The member keeps full
// access and can submit a fresh request later if they still want to.
router.post('/deletion-requests/:userId/cancel', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) return sendError(res, 404, 'User not found');
    if (!user.deletionRequestedAt) return sendError(res, 409, 'No deletion request on file for this user');
    if (user.deletedAt) return sendError(res, 409, 'This account has already been processed, it cannot be cancelled');

    await prisma.user.update({
      where: { id: userId },
      data:  { deletionRequestedAt: null },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId:   req.admin.adminId,
        action:    'cancel_deletion_request',
        targetId:  userId,
        details:   { reason: reason || null, cancelledBy: req.admin.email },
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, { userId, cancelled: true }, 'Deletion request cancelled. The account is untouched.');
  } catch (err) { next(err); }
});
