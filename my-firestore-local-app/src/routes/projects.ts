import { Router } from 'express';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { createProject, getProjectsByOwner, getProjectById, updateProject, deleteProject, getProjectsForUser, isProjectOwner, isProjectEditorOrOwner } from '../services/sqlClient';
import membersRouter from './members';

const router = Router();

router.use(authMiddleware);
router.use('/:id/members', membersRouter);

router.get('/', async (req: AuthedRequest, res) => {
  const userId = req.user.id;
  const projects = await getProjectsForUser(userId);
  res.json(projects);
});

router.post('/', async (req: AuthedRequest, res) => {
  const ownerId = req.user.id;
  const { name, description } = req.body;
  const project = await createProject({ name, description, ownerId });
  res.status(201).json(project);
});

router.get('/:id', async (req: AuthedRequest, res) => {
  const project = await getProjectById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  // allow only owners or members to view
  const userId = req.user.id;
  const allowed = await isProjectOwner(project.id, userId) || (await getProjectsForUser(userId)).some((p: any) => p.id === project.id);
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });
  res.json(project);
});

router.put('/:id', async (req: AuthedRequest, res) => {
  const userId = req.user.id;
  const ok = await isProjectEditorOrOwner(req.params.id, userId);
  if (!ok) return res.status(403).json({ error: 'Forbidden' });
  const updated = await updateProject(req.params.id, req.body);
  res.json(updated);
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  const userId = req.user.id;
  const ok = await isProjectOwner(req.params.id, userId);
  if (!ok) return res.status(403).json({ error: 'Forbidden' });
  await deleteProject(req.params.id);
  res.status(204).send();
});

export default router;
