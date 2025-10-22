const { PrismaClient } = require('@prisma/client');
const { deleteProject } = require('../src/services/sqlClient');

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.create({ data: { email: `deltest+${Date.now()}@example.com`, password: 'x', name: 'Del Test' } });
    const project = await prisma.project.create({ data: { name: 'Delete Test Project ' + Date.now(), ownerId: user.id, members: { create: { userId: user.id, role: 'owner' } } } });
    const status = await prisma.taskStatus.create({ data: { label: 'todo', projectId: project.id } });
    const task = await prisma.task.create({ data: { title: 'Task to be deleted', projectId: project.id, statusId: status.id } });
    console.log('Created project, members, status, task. Now deleting project...');
    await deleteProject(project.id);
    const found = await prisma.project.findUnique({ where: { id: project.id } });
    console.log('Project found after delete (should be null):', found);
  } catch (e) {
    console.error('Error during delete test:', e);
  } finally {
    process.exit(0);
  }
}

main();
