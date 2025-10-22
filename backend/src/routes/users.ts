import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { updateUserById, findUserById } from '../services/sqlClient';
import { listUsers } from '../services/sqlClient';
import { sanitizeInput } from '../middleware/validation';
import { validateUpdateUser, validateGetUser, validatePagination } from '../middleware/validationSchemas';

const router = Router();

// protect all user routes
router.use(authMiddleware);
router.use(sanitizeInput);

// PUT /users/:id - update a user (name, email)
router.put('/:id', validateUpdateUser, async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  // only allow users to update their own profile for now
  if (!req.userId || req.userId !== id) return res.status(403).json({ error: 'Forbidden' });
  const { name, email } = req.body as { name?: string; email?: string };
  try {
    const updated = await updateUserById(id, { name, email });
    res.json({ user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /users/:id - read user (sanitized)
router.get('/:id', validateGetUser, async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const user = await findUserById(id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET /users - list all users (sanitized). Protected.
router.get('/', validatePagination, async (req: AuthedRequest, res: Response) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

export default router;
