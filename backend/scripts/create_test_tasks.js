const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Creating test user...');
    const user = await prisma.user.create({ data: { email: `test+${Date.now()}@example.com`, password: 'x', name: 'Test User' } });
    console.log('User:', user.id);

    console.log('Creating project...');
    const project = await prisma.project.create({
      data: {
        name: 'Test Project ' + Date.now(),
        ownerId: user.id,
        members: { create: { userId: user.id, role: 'owner' } }
      }
    });
    console.log('Project:', project.id);

    console.log('Creating parent task...');
    const parent = await prisma.task.create({ data: { title: 'Parent Task', projectId: project.id } });
    console.log('Parent Task:', parent.id);

    console.log('Creating child/subtask...');
    const child = await prisma.task.create({ data: { title: 'Child Task', projectId: project.id, parentId: parent.id } });
    console.log('Child Task:', child.id, 'parentId:', child.parentId);

    const tasks = await prisma.task.findMany({ where: { projectId: project.id } });
    console.log('All tasks for project:', tasks.map(t => ({ id: t.id, title: t.title, parentId: t.parentId })));
  } catch (e) {
    console.error('Error in script:', e);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
