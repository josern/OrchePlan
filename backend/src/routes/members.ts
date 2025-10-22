import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthedRequest, getReqUserId, ensureUser } from '../middleware/auth';
import { listProjectMembers, addProjectMember, removeProjectMember, updateProjectMemberRole, isProjectOwner, getProjectById, ALLOWED_ROLES, findUserById, MemberRole } from '../services/sqlClient';
import { sanitizeInput } from '../middleware/validation';
import { validateAddProjectMember, validateUpdateProjectMemberRoleParam, validateRemoveProjectMemberParam } from '../middleware/validationSchemas';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(sanitizeInput);

// list members (members and owners can view)
router.get('/', ensureUser, async (req: AuthedRequest, res: Response) => {
  const projectId = req.params.id;
  const userId = req.userId as string;
  const project = await getProjectById(projectId);
  if (!project) return res.status(404).json({ error: 'Not found' });
  const allowed = project.ownerId === userId || project.members.some((m: { userId: string }) => m.userId === userId);
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });
  const members = await listProjectMembers(projectId);
  res.json(members);
});

// add member (owner only)
router.post('/', ensureUser, validateAddProjectMember, async (req: AuthedRequest, res: Response) => {
  const projectId = req.params.id;
  const userId = req.userId as string;
  const newUserId = req.body.userId;
  const role = req.body.role || 'viewer';
  if (!newUserId) return res.status(400).json({ error: 'userId is required' });
  if (!ALLOWED_ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(',')}` });
  const ownerOk = await isProjectOwner(projectId, userId);
  if (!ownerOk) return res.status(403).json({ error: 'Forbidden' });
  const user = await findUserById(newUserId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const result = await addProjectMember(projectId, newUserId, role as MemberRole);
  if (result === 'exists') return res.status(409).json({ error: 'User already a member' });
  if (!result) return res.status(500).json({ error: 'Could not add member' });
  res.status(201).json(result);
});

// update member role (owner only)
router.put('/:userId', ensureUser, validateUpdateProjectMemberRoleParam, async (req: AuthedRequest, res: any) => {
  const projectId = req.params.id;
  const userId = req.userId as string;
  const targetUserId = req.params.userId;
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'role is required' });
  if (!ALLOWED_ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(',')}` });
  const ownerOk = await isProjectOwner(projectId, userId);
  if (!ownerOk) return res.status(403).json({ error: 'Forbidden' });
  const updated = await updateProjectMemberRole(projectId, targetUserId, role as MemberRole);
  if (!updated) return res.status(404).json({ error: 'Member not found' });
  res.json(updated);
});

// remove member (owner only)
router.delete('/:userId', ensureUser, validateRemoveProjectMemberParam, async (req: AuthedRequest, res: any) => {
  const projectId = req.params.id;
  const userId = req.userId as string;
  const targetUserId = req.params.userId;
  const ownerOk = await isProjectOwner(projectId, userId);
  if (!ownerOk) return res.status(403).json({ error: 'Forbidden' });
  const r = await removeProjectMember(projectId, targetUserId);
  if (r === 0) return res.status(404).json({ error: 'Member not found' });
  res.status(204).send();
});

export default router;
