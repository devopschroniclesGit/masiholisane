const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emails = [
    'thabo@masiholisane.co.za',
    'nomsa@masiholisane.co.za',
    'sipho@masiholisane.co.za',
    'zanele@masiholisane.co.za',
  ];

  const result = await prisma.user.updateMany({
    where: { email: { in: emails } },
    data:  { phoneVerified: true },
  });

  console.log(`Fixed ${result.count} test account(s) — phoneVerified set to true.`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
