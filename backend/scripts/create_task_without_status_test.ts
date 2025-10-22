import { PrismaClient } from '@prisma/client';
import { createProject, createTask, listStatusesByProject } from '../src/services/sqlClient';

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.create({ data: { email: `taskstatustest+${Date.now()}@example.com`, password: 'x', name: 'TaskStatus Test' } });
    const project = await createProject({ name: 'TaskStatus Default Project ' + Date.now(), ownerId: user.id });
    console.log('Project created', project.id);
    const statuses = await listStatusesByProject(project.id);
    console.log('Project statuses:', statuses.map((s:any)=>({id:s.id,label:s.label,order:s.order, color: s.color})));
    const task = await createTask({ title: 'No status task', projectId: project.id });
    console.log('Created task', task.id, 'statusId:', task.statusId);
  } catch (e) {
    console.error('Error in script', e);
  } finally {
    process.exit(0);
  }
}

main();
