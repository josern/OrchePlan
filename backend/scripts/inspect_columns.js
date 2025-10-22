const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  try {
    const q1 = await prisma.$queryRawUnsafe("SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('TaskStatus','taskstatus','\"TaskStatus\"') ORDER BY table_name, ordinal_position");
    console.log('columns for TaskStatus variations:', JSON.stringify(q1, null, 2));
    const q2 = await prisma.$queryRawUnsafe("SELECT * FROM \"TaskStatus\" LIMIT 1");
    console.log('sample row from "TaskStatus":', JSON.stringify(q2, null, 2));
  } catch (e) {
    console.error('inspect query failed', e);
  } finally {
    await prisma.$disconnect();
  }
})();
