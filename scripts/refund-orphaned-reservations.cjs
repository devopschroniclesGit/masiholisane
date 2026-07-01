// scripts/refund-orphaned-reservations.cjs
//
// DRY RUN by default - only reports what it would do. Add --apply to
// actually move money. Scope to one user with an email, or omit to check
// everyone.
//
//   node scripts/refund-orphaned-reservations.cjs nomsa@masiholisane.co.za
//   node scripts/refund-orphaned-reservations.cjs nomsa@masiholisane.co.za --apply
//   node scripts/refund-orphaned-reservations.cjs --apply
//
// Unlike the diagnostic script (which just counts reservations vs refunds),
// this traces each individual reservation to its exact group via the
// idempotency key, and only refunds it if:
//   - the user has no active/forming membership in that specific group, AND
//   - no refund transaction already exists for that specific group
//     (covers the admin-cancel-refund path, the self-leave path, and the
//      Cycle 1 recipient auto-refund path)
// This avoids ever double-refunding or refunding something still owed.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const emailArg = process.argv.find(a => a.includes('@'));
const ADMIN_EMAIL = 'admin@masiholisane.co.za'; // attributed in the audit log

const RESERVE_PREFIX = 'reserve-';

function parseGroupId(idempotencyKey, userId) {
  const suffix = `-${userId}`;
  if (!idempotencyKey.startsWith(RESERVE_PREFIX) || !idempotencyKey.endsWith(suffix)) return null;
  return idempotencyKey.slice(RESERVE_PREFIX.length, idempotencyKey.length - suffix.length);
}

async function checkReservation(reservation, userId) {
  const groupId = parseGroupId(reservation.idempotencyKey, userId);
  if (!groupId) return { orphaned: false, reason: 'could not parse groupId from key, skipping for safety' };

  // Still a real, current claim on this exact group?
  const membership = await prisma.stokvelMember.findFirst({
    where: { groupId, userId, status: 'active' },
    include: { group: true },
  });
  if (membership && ['forming', 'active'].includes(membership.group?.status)) {
    return { orphaned: false, reason: `still an active member of this group (${membership.group.status})` };
  }

  // Already refunded via the admin-cancel path (new, fixed code)?
  const adminRefund = await prisma.transaction.findFirst({
    where: { idempotencyKey: `admin-remove-refund-${groupId}-${userId}` },
  });
  if (adminRefund) return { orphaned: false, reason: 'already refunded via admin cancellation' };

  // Already refunded because they were the Cycle 1 recipient (group activated normally)?
  const group = await prisma.stokvelGroup.findUnique({ where: { id: groupId } });
  if (group) {
    const cycle1 = await prisma.stokvelCycle.findFirst({ where: { groupId, cycleNumber: 1 } });
    if (cycle1 && cycle1.recipientId === userId) {
      const recipientRefund = await prisma.transaction.findFirst({
        where: { idempotencyKey: `recipient-refund-${cycle1.id}-${userId}` },
      });
      if (recipientRefund) return { orphaned: false, reason: 'already refunded as Cycle 1 recipient' };
    }
  }

  // No membership, no matching refund anywhere - genuinely orphaned
  return { orphaned: true, groupId };
}

async function main() {
  const users = await prisma.user.findMany({
    where: emailArg ? { email: emailArg } : {},
    select: { id: true, name: true, email: true },
  });

  console.log(APPLY ? 'APPLY MODE - refunds will be issued' : 'DRY RUN - no changes will be made (add --apply to actually refund)');
  console.log(`Checking ${users.length} user(s)...\n`);

  let totalRefunded = 0;
  let totalAmount = 0;

  for (const user of users) {
    const account = await prisma.account.findUnique({ where: { userId: user.id } });
    if (!account) continue;

    const reservations = await prisma.transaction.findMany({
      where: {
        fromAccountId: account.id,
        type:          'contribution',
        description:   { contains: 'reservation locked in' },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (reservations.length === 0) continue;

    const toRefund = [];
    for (const r of reservations) {
      const result = await checkReservation(r, user.id);
      if (result.orphaned) {
        toRefund.push({ transaction: r, groupId: result.groupId });
      }
    }
    if (toRefund.length === 0) continue;

    console.log(`--- ${user.name} (${user.email}) ---`);
    for (const { transaction, groupId } of toRefund) {
      console.log(`  Refunding R${(transaction.amount / 100).toFixed(2)} from group ${groupId} (reserved ${transaction.createdAt.toISOString()})`);

      if (APPLY) {
        const refundKey = `manual-reconcile-refund-${transaction.id}`;
        const existing = await prisma.transaction.findFirst({ where: { idempotencyKey: refundKey } });
        if (existing) {
          console.log(`    already refunded by this script previously (idempotency key exists), skipping`);
          continue;
        }

        await prisma.$transaction(async (tx) => {
          await tx.account.update({
            where: { userId: user.id },
            data:  { balance: { increment: transaction.amount } },
          });
          await tx.transaction.create({
            data: {
              toAccountId:    account.id,
              amount:         transaction.amount,
              type:           'refund',
              status:         'completed',
              idempotencyKey: refundKey,
              description:    `Reservation refunded, manual reconciliation of a pre-fix admin removal`,
            },
          });
        });

        const admin = await prisma.admin.findUnique({ where: { email: ADMIN_EMAIL } });
        if (admin) {
          await prisma.adminAuditLog.create({
            data: {
              adminId:   admin.id,
              action:    'manual_reservation_refund',
              targetId:  user.id,
              details:   { groupId, amount: transaction.amount, originalTransactionId: transaction.id, reason: 'Reconciliation of pre-fix admin-removal refund bug' },
              ipAddress: null,
            },
          });
        }
      }

      totalRefunded += 1;
      totalAmount += transaction.amount;
    }
    console.log('');
  }

  console.log('====================================');
  console.log(`${APPLY ? 'Refunded' : 'Would refund'}: ${totalRefunded} reservation(s), R${(totalAmount / 100).toFixed(2)} total`);
  if (!APPLY && totalRefunded > 0) {
    console.log('Re-run with --apply to actually issue these refunds.');
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

