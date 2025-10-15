import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

export type MemberRole = 'owner' | 'editor' | 'viewer';
export const ALLOWED_ROLES: MemberRole[] = ['owner', 'editor', 'viewer'];

const prisma = new PrismaClient();

// graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;

export async function createUser(email: string, password: string, name?: string) {
  const hashed = await bcrypt.hash(password, 10);
  return prisma.user.create({ data: { email, password: hashed, name } });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(id: string) {
  // intentionally do not return password
  return prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, createdAt: true, updatedAt: true } });
}

export async function createProject(data: { name: string; description?: string; ownerId: string }) {
  return prisma.project.create({ data });
}

export async function createTask(data: { title: string; projectId: string; description?: string; assigneeId?: string; statusId?: string }) {
  return prisma.task.create({ data });
}

export async function getProjectsByOwner(ownerId: string) {
  return prisma.project.findMany({ where: { ownerId }, include: { tasks: true, statuses: true } });
}

export async function getProjectById(id: string) {
  return prisma.project.findUnique({ where: { id }, include: { tasks: true, statuses: true, members: true } });
}

export async function getProjectsForUser(userId: string) {
  return prisma.project.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } }
      ]
    },
    include: { tasks: true, statuses: true, members: true }
  });
}

export async function getProjectMember(projectId: string, userId: string) {
  return prisma.projectMember.findFirst({ where: { projectId, userId } });
}

export async function isProjectOwner(projectId: string, userId: string) {
  const p = await prisma.project.findUnique({ where: { id: projectId } });
  return p ? p.ownerId === userId : false;
}

export async function isProjectEditorOrOwner(projectId: string, userId: string) {
  const owner = await isProjectOwner(projectId, userId);
  if (owner) return true;
  const member = await getProjectMember(projectId, userId);
  if (!member) return false;
  return member.role === 'owner' || member.role === 'editor';
}

// Project member management
export async function listProjectMembers(projectId: string) {
  return prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, email: true, name: true, createdAt: true, updatedAt: true } } }
  });
}

export async function addProjectMember(projectId: string, userId: string, role: MemberRole) {
  // ensure user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  // prevent duplicate
  const existing = await prisma.projectMember.findFirst({ where: { projectId, userId } });
  if (existing) return 'exists';
  const created = await prisma.projectMember.create({ data: { projectId, userId, role } });
  // return with sanitized user
  return prisma.projectMember.findUnique({ where: { id: created.id }, include: { user: { select: { id: true, email: true, name: true, createdAt: true, updatedAt: true } } } });
}

export async function removeProjectMember(projectId: string, userId: string) {
  const found = await prisma.projectMember.findFirst({ where: { projectId, userId } });
  if (!found) return 0;
  await prisma.projectMember.delete({ where: { id: found.id } });
  return 1;
}

export async function updateProjectMemberRole(projectId: string, userId: string, role: MemberRole) {
  const found = await prisma.projectMember.findFirst({ where: { projectId, userId } });
  if (!found) return null;
  const updated = await prisma.projectMember.update({ where: { id: found.id }, data: { role }, include: { user: { select: { id: true, email: true, name: true, createdAt: true, updatedAt: true } } } });
  return updated;
}

export async function getTasksByProject(projectId: string) {
  return prisma.task.findMany({ where: { projectId } });
}

export async function updateProject(id: string, data: any) {
  return prisma.project.update({ where: { id }, data });
}

export async function updateTask(id: string, data: any) {
  return prisma.task.update({ where: { id }, data });
}

export async function deleteProject(id: string) {
  await prisma.task.deleteMany({ where: { projectId: id } });
  return prisma.project.delete({ where: { id } });
}

export async function deleteTask(id: string) {
  return prisma.task.delete({ where: { id } });
}

export async function getTaskById(id: string) {
  return prisma.task.findUnique({ where: { id } });
}
