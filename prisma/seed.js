const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('\n🌱 Seeding database...\n');
  const hash = await bcrypt.hash('Password123!', 12);

  const users = [
    { email: 'thabo@masiholisane.co.za', name: 'Thabo Nkosi',    balance: 200000, score: 65, tier: 'trusted',    verified: true  },
    { email: 'nomsa@masiholisane.co.za', name: 'Nomsa Dlamini',  balance: 150000, score: 75, tier: 'good',       verified: true  },
    { email: 'sipho@masiholisane.co.za', name: 'Sipho Mthembu',  balance: 100000, score: 10, tier: 'restricted', verified: false },
    { email: 'zanele@masiholisane.co.za', name: 'Zanele Mokoena', balance: 200000, score: 55, tier: 'trusted',    verified: true  },
  ];

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, password: hash, name: u.name, verified: u.verified },
    });

    await prisma.account.upsert({
      where: { userId: user.id },
      update: { balance: u.balance },
      create: { userId: user.id, balance: u.balance },
    });

    const existing = await prisma.trustScore.findUnique({ where: { userId: user.id } });
    if (!existing) {
      const ts = await prisma.trustScore.create({
        data: { userId: user.id, score: u.score, tier: u.tier },
      });
      await prisma.trustScoreEvent.create({
        data: {
          userId: user.id,
          scoreId: ts.id,
          event: u.verified ? 'id_verified' : 'account_created',
          delta: u.score,
          scoreBefore: 0,
          scoreAfter: u.score,
          reason: 'Initial seed',
        },
      });
    }
    console.log('  ✓ ' + u.name + ' — R' + (u.balance/100) + ' | Trust: ' + u.score + ' (' + u.tier + ')');
  }

  console.log('\n✅ Done! Password for all users: Password123!\n');
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

async function addTestUser() {
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');
  const prisma = new PrismaClient();

  const hash = await bcrypt.hash('Password123!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'zanele@masiholisane.co.za' },
    update: {},
    create: {
      email: 'zanele@masiholisane.co.za',
      password: hash,
      name: 'Zanele Mokoena',
      verified: true,
    },
  });

  await prisma.account.upsert({
    where: { userId: user.id },
    update: { balance: 200000 },
    create: { userId: user.id, balance: 200000 },
  });

  const existing = await prisma.trustScore.findUnique({ where: { userId: user.id } });
  if (!existing) {
    const ts = await prisma.trustScore.create({
      data: { userId: user.id, score: 55, tier: 'trusted' },
    });
    await prisma.trustScoreEvent.create({
      data: {
        userId: user.id,
        scoreId: ts.id,
        event: 'id_verified',
        delta: 55,
        scoreBefore: 0,
        scoreAfter: 55,
        reason: 'Initial seed',
      },
    });
  }

  console.log('  ✓ Zanele Mokoena — R2,000 | Trust: 55 (trusted)');
  await prisma.$disconnect();
}

addTestUser().catch(console.error);
