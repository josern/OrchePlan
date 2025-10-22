import { PrismaClient } from '@prisma/client';
import { createProject, getProjectsForUser } from '../src/services/sqlClient';

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.create({ data: { email: `projtest+${Date.now()}@example.com`, password: 'x', name: 'Proj Test' } });
    console.log('User', user.id);
    const parent = await createProject({ name: 'Parent Project ' + Date.now(), ownerId: user.id });
    console.log('Parent', parent.id);
    const child = await createProject({ name: 'Child Project ' + Date.now(), ownerId: user.id, parentProjectId: parent.id });
    console.log('Child', child.id, 'parentProjectId', child.parentProjectId);
    const visible = await getProjectsForUser(user.id);
    console.log('Visible projects count:', visible.length);
    console.log(visible.map(p => ({ id: p.id, parentProjectId: (p as any).parentProjectId })));
  } catch (e) {
    console.error('Error in script', e);
  } finally {
    process.exit(0);
  }
}

main();
