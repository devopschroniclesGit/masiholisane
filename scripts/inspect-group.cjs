// scripts/inspect-group.cjs
// READ-ONLY. Prints everything about one group and its members' related
// transactions, no string-pattern assumptions this time.
//
//   node scripts/inspect-group.cjs 54bcefa7-4ff1-47e8-8041-958ac2df2fd8

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const groupId = process.argv[2];
  if (!groupId) {
    console.error('Usage: node scripts/inspect-group.cjs <groupId>');
    process.exit(1);
  }

  const group = await prisma.stokvelGroup.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      cycles:  true,
      escrow:  true,
    },
  });

  if (!group) {
    console.log(`No group found with id ${groupId}. It may have been deleted (that itself is informative, forming groups get deleted once empty).`);
    await prisma.$disconnect();
    return;
  }

  console.log(`Group ${group.id}`);
  console.log(`  Tier: ${group.tier}   Status: ${group.status}   Created: ${group.createdAt.toISOString()}`);
  console.log('');
  console.log('Members:');
  for (const m of group.members) {
    console.log(`  ${m.user.name} (${m.user.email}) - position ${m.position}, membership status: ${m.status}`);
  }
  console.log('');
  console.log('Cycles:');
  for (const c of group.cycles) {
    console.log(`  Cycle ${c.cycleNumber} - recipient: ${c.recipientId} - status: ${c.status} - due: ${c.dueDate?.toISOString()}`);
  }
  console.log('');

  // Every contribution tied to this group, for every member
  const contributions = await prisma.stokvelContribution.findMany({
    where: { groupId },
    orderBy: { createdAt: 'asc' },
  });
  console.log('Contributions on this group:');
  for (const c of contributions) {
    const member = group.members.find(m => m.userId === c.userId);
    console.log(`  ${member?.user?.name || c.userId}  R${(c.amount/100).toFixed(2)}  type=${c.type}  status=${c.status}  cycle=${c.cycleId}`);
  }
  console.log('');

  // Full transaction history for each member, no description filtering at all
  for (const m of group.members) {
    const account = await prisma.account.findUnique({ where: { userId: m.userId } });
    if (!account) continue;
    const transactions = await prisma.transaction.findMany({
      where: { OR: [{ fromAccountId: account.id }, { toAccountId: account.id }] },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`Full transaction history for ${m.user.name} (${m.user.email}):`);
    for (const t of transactions) {
      const direction = t.fromAccountId === account.id ? 'OUT' : 'IN ';
      console.log(`  [${direction}] R${(t.amount/100).toFixed(2)}  ${t.type}  ${t.createdAt.toISOString()}  "${t.description}"`);
    }
    console.log('');
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

