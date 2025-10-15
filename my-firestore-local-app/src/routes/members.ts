import { Router } from 'express';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { listProjectMembers, addProjectMember, removeProjectMember, updateProjectMemberRole, isProjectOwner, getProjectById, ALLOWED_ROLES, findUserById } from '../services/sqlClient';

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
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (!ALLOWED_ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(',')}` });
  const requester = req.user.id;
  const ownerOk = await isProjectOwner(projectId, requester);
  if (!ownerOk) return res.status(403).json({ error: 'Forbidden' });
  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const result = await addProjectMember(projectId, userId, role as any);
  if (result === 'exists') return res.status(409).json({ error: 'User already a member' });
  if (!result) return res.status(500).json({ error: 'Could not add member' });
  res.status(201).json(result);
});

// update member role (owner only)
router.put('/:userId', async (req: AuthedRequest, res) => {
  const projectId = req.params.id;
  const targetUserId = req.params.userId;
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'role is required' });
  if (!ALLOWED_ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(',')}` });
  const requester = req.user.id;
  const ownerOk = await isProjectOwner(projectId, requester);
  if (!ownerOk) return res.status(403).json({ error: 'Forbidden' });
  const updated = await updateProjectMemberRole(projectId, targetUserId, role as any);
  if (!updated) return res.status(404).json({ error: 'Member not found' });
  res.json(updated);
});

// remove member (owner only)
router.delete('/:userId', async (req: AuthedRequest, res) => {
  const projectId = req.params.id;
  const targetUserId = req.params.userId;
  const requester = req.user.id;
  const ownerOk = await isProjectOwner(projectId, requester);
  if (!ownerOk) return res.status(403).json({ error: 'Forbidden' });
  const r = await removeProjectMember(projectId, targetUserId);
  if (r === 0) return res.status(404).json({ error: 'Member not found' });
  res.status(204).send();
});

export default router;
