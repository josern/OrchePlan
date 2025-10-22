import { PrismaClient } from '@prisma/client';
import { createProject } from '../src/services/sqlClient';

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.create({ data: { email: `statustest+${Date.now()}@example.com`, password: 'x', name: 'Status Test' } });
    const project = await createProject({ name: 'Status Test Project ' + Date.now(), ownerId: user.id });
    console.log('Created project', project.id);
    console.log('Statuses:', project.statuses.map((s: any) => ({ id: s.id, label: s.label, order: s.order })));
  } catch (e) {
    console.error('Error in script', e);
  } finally {
    process.exit(0);
  }
}

main();
