// Use a runtime require and fall back to `any`-typed aliases so the editor/TS server
// doesn't emit spurious errors if the generated Prisma client isn't visible to the
// language service. At runtime this still constructs the real PrismaClient.
const PrismaPkg: any = require('@prisma/client');
const { PrismaClient } = PrismaPkg;
import bcrypt from 'bcrypt';

export type MemberRole = 'owner' | 'editor' | 'viewer';
export const ALLOWED_ROLES: MemberRole[] = ['owner', 'editor', 'viewer'];

// lightweight aliases for editor stability
type Prisma = any;
type Project = any;
type Task = any;
type TaskStatus = any;
type ProjectMember = any;

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
  // intentionally do not return password but include role for authorization
  return prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true } });
}

export async function findUserByIdWithPassword(id: string) {
  // Include password for authentication purposes
  return prisma.user.findUnique({ where: { id } });
}

export async function listUsers() {
  return prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true } });
}

export async function updateUserById(id: string, data: { name?: string; email?: string }) {
  // do not allow updating password through this helper
  return prisma.user.update({ where: { id }, data, select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true } });
}

export async function updateUserPassword(id: string, hashedPassword: string) {
  // Update user password with pre-hashed password
  return prisma.user.update({ 
    where: { id }, 
    data: { password: hashedPassword },
    select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true } 
  });
}

export type StatusRow = { id: string; label: string; order: number | null; color: string | null; projectId: string; showStrikeThrough?: boolean; hidden?: boolean; requiresComment?: boolean; allowsComment?: boolean };

export type ProjectWithExtras = Project & { statuses: StatusRow[]; tasks: Task[]; members: ProjectMember[] };

export async function createProject(data: { name: string; description?: string; ownerId: string; parentProjectId?: string | null }) {
  const { name, description, ownerId, parentProjectId } = data;
  // create the project and add the owner as a project member with role 'owner'
  // if parentProjectId provided, validate it references an existing project
  if (parentProjectId) {
      const parent = await prisma.project.findUnique({ where: { id: parentProjectId } });
    if (!parent) throw new Error('parent project not found');
  }

  const createData: any = {
    name,
    description,
    owner: { connect: { id: ownerId } },
    members: { create: [{ userId: ownerId, role: 'owner' }] }
  } as any;
    if (parentProjectId) createData.parentProject = { connect: { id: parentProjectId } };

  // create default statuses with color using nested create now that Prisma client supports the field
  // cast as any because Prisma client types may not be regenerated at edit-time
  const defaultStatuses: any[] = [
    { label: 'To-Do', order: 0, color: '#3B82F6', showStrikeThrough: false, hidden: false },
    { label: 'In Progress', order: 1, color: '#EAB308', showStrikeThrough: false, hidden: false },
    { label: 'Done', order: 2, color: '#22C55E', showStrikeThrough: false, hidden: false },
    { label: 'Remove', order: 3, color: '#EF4444', showStrikeThrough: false, hidden: false },
  ];

  // Prisma nested create expects nested objects; cast through unknown to the specific nested create input type
    createData.statuses = { create: defaultStatuses };

  return prisma.project.create({ data: createData, include: { tasks: true, statuses: true, members: true } }) as Promise<ProjectWithExtras>;
}

export async function createTask(data: { title: string; projectId: string; description?: string; priority?: string; assigneeId?: string; statusId?: string; parentId?: string | null; dueTime?: string | null }) {
  let { title, projectId, description, priority, assigneeId, statusId, parentId, dueTime } = data;

  // normalize blank values
  if (assigneeId && typeof assigneeId === 'string') {
    assigneeId = assigneeId.trim() || undefined;
  }
  if (statusId && typeof statusId === 'string') {
    statusId = statusId.trim() || undefined;
  }

  // validate referenced IDs to avoid foreign key violations
  if (assigneeId) {
    if (typeof assigneeId !== 'string') throw new Error('invalid assigneeId');
    const user = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!user) throw new Error('assignee not found');
  }

  // If no statusId provided, pick the project's first status (lowest order) as default
  if (!statusId) {
    const statuses = await listStatusesByProject(projectId);
    if (Array.isArray(statuses) && statuses.length > 0) {
      statusId = statuses[0].id;
    } else {
    statusId = undefined;
    }
  } else {
    if (typeof statusId !== 'string') throw new Error('invalid statusId');
    const status = await prisma.taskStatus.findUnique({ where: { id: statusId } });
    if (!status) throw new Error('status not found');
    if (status.projectId !== projectId) throw new Error('status does not belong to project');
  }

  // validate parentId if provided: must exist and belong to same project
  if (parentId !== undefined && parentId !== null) {
    if (typeof parentId !== 'string') throw new Error('invalid parentId');
    const parent = await prisma.task.findUnique({ where: { id: parentId } });
    if (!parent) throw new Error('parent task not found');
    if (parent.projectId !== projectId) throw new Error('parent task does not belong to project');
  }

  // Defensive logging to help diagnose FK violations (Prisma P2003)
  try {
  const createData: any = {
      title,
      description,
      priority: priority || 'normal', // Default to medium if not provided
      dueTime: dueTime ? new Date(dueTime) : undefined,
      project: { connect: { id: projectId } },
      assignee: assigneeId ? { connect: { id: assigneeId } } : undefined,
      status: statusId ? { connect: { id: statusId } } : undefined,
      parent: parentId ? { connect: { id: parentId } } : undefined,
  } as any;
    return await prisma.task.create({ data: createData });
  } catch (e_) {
    const e = e_ as any;
    // handle Prisma FK error (P2003) defensively
    if (e && e.code === 'P2003') {
      console.error('Prisma P2003 while creating task:', e.meta || e);
      throw new Error('invalid foreign key reference');
    }
    throw e_;
  }
}

export async function getProjectsByOwner(ownerId: string) {
  const raw = await prisma.project.findMany({ where: { ownerId }, include: { tasks: true, members: true } });
  const projs: ProjectWithExtras[] = await Promise.all(raw.map(async (p: any) => ({ ...p, statuses: await listStatusesByProject(p.id) })));
  return projs;
}

export async function getProjectById(id: string) {
  const p = await prisma.project.findUnique({ where: { id }, include: { tasks: true, members: true } });
  if (!p) return null;
  const proj: ProjectWithExtras = { ...p, statuses: await listStatusesByProject(p.id) };
  return proj;
}

export async function getProjectsForUser(userId: string) {
  const raw = await prisma.project.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } }
      ]
    },
    include: { tasks: true, members: true }
  });
  const projs: ProjectWithExtras[] = await Promise.all(raw.map(async (p: any) => ({ ...p, statuses: await listStatusesByProject(p.id) })));
  return projs;
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

// TaskStatus (statuses) helpers
export async function listStatusesByProject(projectId: string) {
  const rows = await prisma.$queryRaw<StatusRow[]>
  `
    SELECT "id", "label", "order", "color", "projectId", "showStrikeThrough", "hidden", "requiresComment", "allowsComment"
    FROM "TaskStatus"
    WHERE "projectId" = ${projectId}
    ORDER BY "order" ASC NULLS LAST
  `;
  return rows;
}

export async function createStatus(projectId: string, label: string, order?: number, color?: string | null, showStrikeThrough?: boolean, hidden?: boolean, requiresComment?: boolean, allowsComment?: boolean) {
  const createData: any = { 
    project: { connect: { id: projectId } }, 
    label, 
    order: order ?? 0, 
    color: color ?? null, 
    showStrikeThrough: showStrikeThrough ?? false, 
    hidden: hidden ?? false,
    requiresComment: requiresComment ?? false,
    allowsComment: allowsComment ?? true
  };
  return prisma.taskStatus.create({ data: createData });
}

export async function updateStatus(id: string, data: { label?: string; order?: number; color?: string | null; showStrikeThrough?: boolean; hidden?: boolean; requiresComment?: boolean; allowsComment?: boolean }) {
  const payload: any = {} as any;
  if (data.label !== undefined) payload.label = data.label;
  if (data.order !== undefined) payload.order = data.order;
  if (data.color !== undefined) payload.color = data.color as string | null;
  if (data.showStrikeThrough !== undefined) (payload as any).showStrikeThrough = data.showStrikeThrough as boolean;
  if (data.hidden !== undefined) (payload as any).hidden = data.hidden as boolean;
  if (data.requiresComment !== undefined) (payload as any).requiresComment = data.requiresComment as boolean;
  if (data.allowsComment !== undefined) (payload as any).allowsComment = data.allowsComment as boolean;
  return prisma.taskStatus.update({ where: { id }, data: payload });
}

export async function deleteStatus(id: string) {
  return prisma.taskStatus.delete({ where: { id } });
}

export async function getStatusById(id: string) {
  return prisma.taskStatus.findUnique({ where: { id } });
}

// TaskComment helpers
export async function createTaskComment(taskId: string, authorId: string, content: string, statusId?: string) {
  return prisma.taskComment.create({
    data: {
      taskId,
      authorId,
      content,
      statusId
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      status: {
        select: {
          id: true,
          label: true,
          color: true
        }
      }
    }
  });
}

export async function getTaskComments(taskId: string) {
  return prisma.taskComment.findMany({
    where: { taskId },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      status: {
        select: {
          id: true,
          label: true,
          color: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });
}

export async function updateTaskComment(id: string, content: string) {
  return prisma.taskComment.update({
    where: { id },
    data: { content },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      status: {
        select: {
          id: true,
          label: true,
          color: true
        }
      }
    }
  });
}

export async function deleteTaskComment(id: string) {
  return prisma.taskComment.delete({ where: { id } });
}

export async function updateStatusesOrder(projectId: string, statuses: { id: string; order: number }[]) {
  // perform updates in a transaction
  return prisma.$transaction(statuses.map(s => prisma.taskStatus.update({ where: { id: s.id }, data: { order: s.order } })));
}

export async function updateProject(id: string, data: any) {
  return prisma.project.update({ where: { id }, data });
}

export async function updateTask(id: string, data: { title?: string; description?: string; priority?: string; parentId?: string | null; statusId?: string | null; status?: string | null; assigneeId?: string | null; dueTime?: string | null }) {
  // Only allow a safe subset of updatable fields from the client
  const payload: any = {} as any;
  if (data.title !== undefined) payload.title = data.title;
  if (data.description !== undefined) payload.description = data.description;
  if (data.priority !== undefined) payload.priority = data.priority;
  if (data.dueTime !== undefined) (payload as any).dueTime = data.dueTime ? new Date(data.dueTime) : null;
  // accept either `statusId` or `status` from client
  const statusId = data.statusId ?? data.status;
  if (statusId !== undefined) payload.status = statusId ? { connect: { id: statusId } } : { disconnect: true } as any;
  if (data.parentId !== undefined) payload.parent = data.parentId ? { connect: { id: data.parentId } } : { disconnect: true } as any;
  if (data.assigneeId !== undefined) payload.assignee = data.assigneeId ? { connect: { id: data.assigneeId } } : { disconnect: true } as any;

  // if no updatable fields provided, return current task
  if (Object.keys(payload).length === 0) {
    return prisma.task.findUnique({ where: { id } });
  }

  // validate assignee/status to avoid FK errors
  // validate assignee/status to avoid FK errors
  if (data.assigneeId) {
    const user = await prisma.user.findUnique({ where: { id: data.assigneeId } });
    if (!user) throw new Error('assignee not found');
  }

  if (statusId) {
    const status = await prisma.taskStatus.findUnique({ where: { id: statusId } });
    if (!status) throw new Error('status not found');
    // ensure the status belongs to the same project as the task
    const existing = await prisma.task.findUnique({ where: { id }, select: { projectId: true } });
    if (!existing) throw new Error('task not found');
    if (status.projectId !== existing.projectId) throw new Error('status does not belong to project');
  }

  try {
    return await prisma.task.update({ where: { id }, data: payload });
  } catch (e_) {
    const e = e_ as any;
    if (e && e.code === 'P2003') {
      console.error('Prisma P2003 while updating task:', e.meta || e);
      throw new Error('invalid foreign key reference');
    }
    throw e_;
  }
}

export async function deleteProject(id: string) {
  try {
    // delete related rows in a safe order inside a transaction
    return await prisma.$transaction(async (tx: any) => {
      // delete tasks belonging to project
      await tx.task.deleteMany({ where: { projectId: id } });
      // delete project members
      await tx.projectMember.deleteMany({ where: { projectId: id } });
      // delete task statuses
      await tx.taskStatus.deleteMany({ where: { projectId: id } });
      // finally delete the project
      return tx.project.delete({ where: { id } });
    });
  } catch (e_) {
    const e = e_ as any;
    if (e && e.code === 'P2003') {
      console.error('Prisma P2003 while deleting project:', e.meta || e);
      throw new Error('invalid foreign key reference');
    }
    throw e_;
  }
}

export async function deleteTask(id: string) {
  return prisma.task.delete({ where: { id } });
}

export async function getTaskById(id: string) {
  return prisma.task.findUnique({ where: { id } });
}
