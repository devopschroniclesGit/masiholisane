// scripts/diagnose-stuck-reservations.cjs
// READ-ONLY. Does not modify any data. Run with:
//   node scripts/diagnose-stuck-reservations.cjs
// Optionally scope to one user:
//   node scripts/diagnose-stuck-reservations.cjs nomsa@masiholisane.co.za

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emailFilter = process.argv[2];

  const users = await prisma.user.findMany({
    where: emailFilter ? { email: emailFilter } : {},
    select: { id: true, name: true, email: true },
  });

  console.log(`Checking ${users.length} user(s) for orphaned reservation transactions...\n`);

  let totalOrphaned = 0;
  let totalOrphanedAmount = 0;

  for (const user of users) {
    const account = await prisma.account.findUnique({ where: { userId: user.id } });
    if (!account) continue;

    // Every reservation ever taken from this user, oldest first
    const reservations = await prisma.transaction.findMany({
      where: {
        fromAccountId: account.id,
        type:          'contribution',
        description:   { contains: 'reservation locked in' },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (reservations.length === 0) continue;

    // Any refund ever issued back to this user referencing a reservation
    const refunds = await prisma.transaction.findMany({
      where: {
        toAccountId: account.id,
        type:        'refund',
        description: { contains: 'Reservation refunded' },
      },
    });

    // Groups this user is CURRENTLY still a member of (forming or active) -
    // reservations tied to these are legitimately still held, not orphaned
    const currentMemberships = await prisma.stokvelMember.findMany({
      where: {
        userId: user.id,
        status: 'active',
        group:  { status: { in: ['forming', 'active'] } },
      },
    });

    const reservedCount   = reservations.length;
    const refundedCount   = refunds.length;
    const stillOwedCount  = currentMemberships.length;
    const orphanedCount   = reservedCount - refundedCount - stillOwedCount;

    if (orphanedCount > 0) {
      const reservedTotal = reservations.reduce((s, r) => s + r.amount, 0);
      const refundedTotal = refunds.reduce((s, r) => s + r.amount, 0);
      // Rough amount at risk - assumes uniform tier amounts, flagged for manual review either way
      const avgAmount = reservedTotal / reservedCount;
      const orphanedAmount = Math.round(avgAmount * orphanedCount);

      console.log(`--- ${user.name} (${user.email}) ---`);
      console.log(`  Reservations taken:     ${reservedCount}`);
      console.log(`  Refunds already issued: ${refundedCount}`);
      console.log(`  Still in an active/forming group: ${stillOwedCount}`);
      console.log(`  LIKELY ORPHANED: ${orphanedCount} reservation(s), roughly R${(orphanedAmount / 100).toFixed(2)}`);
      console.log(`  Reservation transaction IDs:`);
      reservations.forEach(r => console.log(`    ${r.id}  R${(r.amount/100).toFixed(2)}  ${r.createdAt.toISOString()}  key=${r.idempotencyKey}`));
      console.log(`  Refund transaction IDs already on file:`);
      refunds.forEach(r => console.log(`    ${r.id}  R${(r.amount/100).toFixed(2)}  ${r.createdAt.toISOString()}`));
      console.log('');

      totalOrphaned += orphanedCount;
      totalOrphanedAmount += orphanedAmount;
    }
  }

  console.log('====================================');
  console.log(`Total likely orphaned reservations: ${totalOrphaned}`);
  console.log(`Total amount at risk (approx): R${(totalOrphanedAmount / 100).toFixed(2)}`);
  console.log('This script made NO changes. Share this output before any refund is issued.');

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

