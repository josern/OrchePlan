import { Router } from 'express';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { createTask, getTasksByProject, updateTask, deleteTask, isProjectEditorOrOwner, getProjectById, getTaskById } from '../services/sqlClient';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/', async (req: AuthedRequest, res) => {
  const projectId = req.query.projectId as string;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });
  const project = await getProjectById(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  // allow members/owners to list
  const userId = req.user.id;
  const allowed = project.ownerId === userId || project.members.some((m: any) => m.userId === userId);
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });
  const tasks = await getTasksByProject(projectId);
  res.json(tasks);
});

router.post('/', async (req: AuthedRequest, res) => {
  const { title, description, projectId, assigneeId, statusId } = req.body;
  if (!projectId || !title) return res.status(400).json({ error: 'projectId and title required' });
  const userId = req.user.id;
  const ok = await isProjectEditorOrOwner(projectId, userId);
  if (!ok) return res.status(403).json({ error: 'Forbidden' });
  const task = await createTask({ title, description, projectId, assigneeId, statusId });
  res.status(201).json(task);
});

router.put('/:id', async (req: AuthedRequest, res) => {
  // ensure user can edit tasks in the project
  const taskId = req.params.id;
  const updated = await updateTask(taskId, req.body);
  const projectId = updated.projectId;
  const ok = await isProjectEditorOrOwner(projectId, req.user.id);
  if (!ok) return res.status(403).json({ error: 'Forbidden' });
  res.json(updated);
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  const taskId = req.params.id;
  const task = await getTaskById(taskId);
  if (!task) return res.status(404).json({ error: 'Not found' });
  const ok = await isProjectEditorOrOwner(task.projectId, req.user.id);
  if (!ok) return res.status(403).json({ error: 'Forbidden' });
  await deleteTask(taskId);
  res.status(204).send();
});

export default router;
