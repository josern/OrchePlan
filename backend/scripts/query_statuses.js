const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe('SELECT id, label, color, projectId, "order" FROM "TaskStatus" ORDER BY "order" ASC NULLS LAST, id LIMIT 100');
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error('Query failed', e);
  } finally {
    await prisma.$disconnect();
  }
})();
