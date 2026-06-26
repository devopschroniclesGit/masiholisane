const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const email    = process.argv[2] || 'admin@masiholisane.co.za';
  const password = process.argv[3] || 'MasiAdmin2025!';
  const name     = process.argv[4] || 'Platform Admin';

  const hash  = await bcrypt.hash(password, 12);
  const admin = await prisma.admin.upsert({
    where:  { email },
    update: { password: hash, name },
    create: { email, password: hash, name, role: 'superadmin' },
  });

  console.log('\n✅ Admin created:');
  console.log('   Email:   ', email);
  console.log('   Password:', password);
  console.log('   Role:    ', admin.role);
  console.log('\n⚠️  Change password before going live!\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
