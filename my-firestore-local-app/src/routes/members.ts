import { Router } from 'express';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { listProjectMembers, addProjectMember, removeProjectMember, updateProjectMemberRole, isProjectOwner, getProjectById } from '../services/sqlClient';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

// list members (members and owners can view)
router.get('/', async (req: AuthedRequest, res) => {
  const projectId = req.params.id;
  const project = await getProjectById(projectId);
  if (!project) return res.status(404).json({ error: 'Not found' });
  const userId = req.user.id;
  const allowed = project.ownerId === userId || project.members.some((m: any) => m.userId === userId);
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });
  const members = await listProjectMembers(projectId);
  res.json(members);
});

// add member (owner only)
router.post('/', async (req: AuthedRequest, res) => {
  const projectId = req.params.id;
  const userId = req.body.userId;
  const role = req.body.role || 'viewer';
  const requester = req.user.id;
  const ownerOk = await isProjectOwner(projectId, requester);
  if (!ownerOk) return res.status(403).json({ error: 'Forbidden' });
  const member = await addProjectMember(projectId, userId, role);
  res.status(201).json(member);
});

// update member role (owner only)
router.put('/:userId', async (req: AuthedRequest, res) => {
  const projectId = req.params.id;
  const targetUserId = req.params.userId;
  const { role } = req.body;
  const requester = req.user.id;
  const ownerOk = await isProjectOwner(projectId, requester);
  if (!ownerOk) return res.status(403).json({ error: 'Forbidden' });
  const updated = await updateProjectMemberRole(projectId, targetUserId, role);
  res.json(updated);
});

// remove member (owner only)
router.delete('/:userId', async (req: AuthedRequest, res) => {
  const projectId = req.params.id;
  const targetUserId = req.params.userId;
  const requester = req.user.id;
  const ownerOk = await isProjectOwner(projectId, requester);
  if (!ownerOk) return res.status(403).json({ error: 'Forbidden' });
  await removeProjectMember(projectId, targetUserId);
  res.status(204).send();
});

export default router;
