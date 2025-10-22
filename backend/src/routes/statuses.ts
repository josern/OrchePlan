import express, { Response, NextFunction } from 'express';
import {
  listStatusesByProject,
  createStatus,
  updateStatus,
  deleteStatus,
  updateStatusesOrder,
  getProjectById,
} from '../services/sqlClient';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { sanitizeInput } from '../middleware/validation';
import { validateCreateStatus, validateUpdateStatusParam, validateDeleteStatusParam, validateUpdateStatusOrder } from '../middleware/validationSchemas';

const router = express.Router({ mergeParams: true });

// require authentication for all status routes
router.use(authMiddleware);
router.use(sanitizeInput);

// GET /projects/:id/statuses
router.get('/', async (req: AuthedRequest, res: Response) => {
  const { id: projectId } = req.params as { id: string };
  try {
    const project = await getProjectById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const statuses = await listStatusesByProject(projectId);
    res.json({ statuses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to list statuses' });
  }
});

// POST /projects/:id/statuses
router.post('/', validateCreateStatus, async (req: AuthedRequest, res: Response) => {
  const { id: projectId } = req.params as { id: string };
  const { label, order, color, showStrikeThrough, hidden, requiresComment, allowsComment } = req.body as { 
    label: string; 
    order?: number; 
    color?: string | null; 
    showStrikeThrough?: boolean; 
    hidden?: boolean;
    requiresComment?: boolean;
    allowsComment?: boolean;
  };
  if (!label) return res.status(400).json({ message: 'label is required' });
  try {
    const project = await getProjectById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });
  const status = await createStatus(projectId, label, order, color, showStrikeThrough, hidden, requiresComment, allowsComment);
    res.status(201).json({ status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create status' });
  }
});

// PUT /projects/:id/statuses/:statusId
router.put('/:statusId', validateUpdateStatusParam, async (req: AuthedRequest, res: Response) => {
  const { statusId } = req.params as { statusId: string };
  const { label, order, color, showStrikeThrough, hidden, requiresComment, allowsComment } = req.body as { 
    label?: string; 
    order?: number; 
    color?: string | null; 
    showStrikeThrough?: boolean; 
    hidden?: boolean;
    requiresComment?: boolean;
    allowsComment?: boolean;
  };
  try {
    const status = await updateStatus(statusId, { label, order, color, showStrikeThrough, hidden, requiresComment, allowsComment });
    res.json({ status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update status' });
  }
});

// DELETE /projects/:id/statuses/:statusId
router.delete('/:statusId', validateDeleteStatusParam, async (req: AuthedRequest, res: Response) => {
  const { statusId } = req.params as { statusId: string };
  try {
    await deleteStatus(statusId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete status' });
  }
});

// PATCH /projects/:id/statuses/order
// body: { statuses: [{ id, order }, ...] }
router.patch('/order', async (req, res) => {
  const { id: projectId } = req.params as { id: string };
  const { statuses } = req.body as { statuses: { id: string; order: number }[] };
  if (!Array.isArray(statuses)) return res.status(400).json({ message: 'statuses array is required' });
  try {
    await updateStatusesOrder(projectId, statuses);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update order' });
  }
});

export default router;
