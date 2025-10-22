import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthedRequest, getReqUserId, ensureUser } from '../middleware/auth';
import { createProject, getProjectsByOwner, getProjectById, updateProject, deleteProject, getProjectsForUser, isProjectOwner, isProjectEditorOrOwner } from '../services/sqlClient';
import { realtimeService } from '../services/realtime';
import { sanitizeInput } from '../middleware/validation';
import { validateCreateProject, validateUpdateProject, validateDeleteProject, validateGetProject, validatePagination } from '../middleware/validationSchemas';
import membersRouter from './members';
import statusesRouter from './statuses';

const router = Router();

router.use(authMiddleware);
router.use(sanitizeInput);
router.use('/:id/members', membersRouter);
router.use('/:id/statuses', statusesRouter);

router.get('/', ensureUser, validatePagination, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  const projects = await getProjectsForUser(userId);
  res.json(projects);
});

router.post('/', ensureUser, validateCreateProject, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const ownerId = req.userId as string;
  const { name, description, parentProjectId } = req.body;
  const project = await createProject({ name, description, ownerId, parentProjectId });
  
  // Broadcast project creation to relevant clients
  realtimeService.broadcastProjectUpdate(project, 'created');
  
  res.status(201).json(project);
});

router.get('/:id', ensureUser, validateGetProject, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  const project = await getProjectById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  // allow only owners or members to view
  const allowed = await isProjectOwner(project.id, userId) || (await getProjectsForUser(userId)).some((p: any) => p.id === project.id);
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });
  res.json(project);
});

router.put('/:id', ensureUser, validateUpdateProject, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  const ok = await isProjectEditorOrOwner(req.params.id, userId);
  if (!ok) return res.status(403).json({ error: 'Forbidden' });
  const updated = await updateProject(req.params.id, req.body);
  
  // Broadcast project update to relevant clients
  realtimeService.broadcastProjectUpdate(updated, 'updated');
  
  res.json(updated);
});

router.delete('/:id', ensureUser, validateDeleteProject, async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  const ok = await isProjectOwner(req.params.id, userId);
  if (!ok) return res.status(403).json({ error: 'Forbidden' });
  const deleted = await deleteProject(req.params.id);
  
  // Broadcast project deletion to relevant clients
  realtimeService.broadcastProjectUpdate({ id: req.params.id }, 'deleted');
  
  res.json(deleted);
});

export default router;
