import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthedRequest, getReqUserId, ensureUser } from '../middleware/auth';
import { createTask, getTasksByProject, updateTask, deleteTask, isProjectEditorOrOwner, getProjectById, getTaskById, getProjectsForUser, getStatusById, createTaskComment, getTaskComments, updateTaskComment, deleteTaskComment } from '../services/sqlClient';
import { realtimeService } from '../services/realtime';
import { sanitizeInput } from '../middleware/validation';
import { validateCreateTask, validateUpdateTask, validateDeleteTask, validateMoveTask, validatePagination } from '../middleware/validationSchemas';
import prisma from '../services/sqlClient';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(sanitizeInput);

router.get('/', ensureUser, validatePagination, async (req: AuthedRequest, res: Response) => {
  try {
    // support multiple projectId query params (e.g. ?projectId=a&projectId=b)
    const raw = req.query.projectId;
    if (!raw) return res.status(400).json({ error: 'projectId required' });
    
    let projectIds: string[];
    if (Array.isArray(raw)) {
      projectIds = raw.map(x => String(x));
    } else if (typeof raw === 'object') {
      // Handle case where Express parses multiple params as an object with numeric keys
      projectIds = Object.values(raw).map(x => String(x));
    } else {
      projectIds = [String(raw)];
    }

    if (projectIds.length === 0) return res.status(400).json({ error: 'projectId required' });

  const userId = req.userId as string;
    // fetch projects visible to user and ensure requested ids are subset
    const visible = await getProjectsForUser(userId);
  const visibleIds = new Set(visible.map((p: { id: string }) => p.id));
    
    for (const pid of projectIds) {
      if (!visibleIds.has(pid)) {
        return res.status(403).json({ error: 'Forbidden to access one or more projects' });
      }
    }

    // fetch tasks for each project and combine
  const results: any[] = [];
    for (const pid of projectIds) {
      const tasks = await getTasksByProject(pid);
      results.push(...tasks);
    }

    res.json(results);
  } catch (err) {
    console.error('Error in GET /tasks', err);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

router.post('/', ensureUser, validateCreateTask, async (req: AuthedRequest, res: Response) => {
  try {
    const { title, description, priority, projectId, assigneeId, statusId, parentId } = req.body;
    
    if (!projectId || !title) return res.status(400).json({ error: 'projectId and title required' });
    const userId = req.userId as string;
    const ok = await isProjectEditorOrOwner(projectId, userId);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });
    
    const task = await createTask({ title, description, priority, projectId, assigneeId, statusId, parentId });
    
    // Broadcast task creation to other clients
    realtimeService.broadcastTaskUpdate(task, 'created');
    
    res.status(201).json(task);
  } catch (err_) {
    const err = err_ as Error & { code?: string; meta?: unknown };
    
    // handle validation errors thrown by helpers
    if (err.message === 'assignee not found' || err.message === 'status not found' || err.message === 'status does not belong to project' || err.message === 'invalid assigneeId' || err.message === 'invalid statusId') {
      return res.status(400).json({ error: err.message });
    }

    // catch Prisma FK error if it somehow still occurs
    if (err.code === 'P2003') {
      console.error('Prisma P2003 while creating task:', err.meta || err);
      return res.status(400).json({ error: 'Invalid foreign key reference' });
    }

    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// POST /tasks/:id/move - Handle task status moves with comment requirements
router.post('/:id/move', ensureUser, validateMoveTask, async (req: AuthedRequest, res: Response) => {
  const taskId = req.params.id;
  try {
    const { statusId, comment } = req.body as { statusId: string; comment?: string };
    
    if (!statusId) return res.status(400).json({ error: 'statusId is required' });
    
    const existing = await getTaskById(taskId);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const uid = req.userId as string;
    const ok = await isProjectEditorOrOwner(existing.projectId, uid);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });

    // Check if the target status requires a comment
    const targetStatus = await getStatusById(statusId);
    if (!targetStatus) return res.status(400).json({ error: 'Status not found' });
    
    if (targetStatus.requiresComment && (!comment || comment.trim() === '')) {
      return res.status(400).json({ 
        error: 'Comment required', 
        requiresComment: true,
        statusName: targetStatus.label 
      });
    }

    // Update the task status
    const updated = await updateTask(taskId, { statusId });
    if (!updated) return res.status(404).json({ error: 'Failed to update task' });

    // Save comment if provided
    if (comment && comment.trim() !== '') {
      await createTaskComment(taskId, uid, comment.trim(), statusId);
    }

    // Broadcast task update to other clients
    realtimeService.broadcastTaskUpdate(updated, 'updated');

    res.json({ 
      task: updated, 
      comment: comment || null,
      statusRequiredComment: targetStatus.requiresComment 
    });
  } catch (err) {
    console.error('Error moving task:', err);
    res.status(500).json({ error: 'Failed to move task' });
  }
});

router.put('/:id', ensureUser, validateUpdateTask, async (req: AuthedRequest, res: Response) => {
  const taskId = req.params.id;
  try {

    const existing = await getTaskById(taskId);
    if (!existing) return res.status(404).json({ error: 'Not found' });

  const uid = req.userId as string;
  const ok = await isProjectEditorOrOwner(existing.projectId, uid);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });

    const updated = await updateTask(taskId, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });

    // Broadcast task update to other clients
    realtimeService.broadcastTaskUpdate(updated, 'updated');

    res.json(updated);
  } catch (err_) {
    const err = err_ as Error & { code?: string; meta?: unknown };
    // map validation errors
    if (err.message === 'assignee not found' || err.message === 'status not found' || err.message === 'status does not belong to project' || err.message === 'invalid assigneeId' || err.message === 'invalid statusId' || err.message === 'task not found') {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'P2003') {
      console.error('Prisma P2003 while updating task:', err.meta || err);
      return res.status(400).json({ error: 'Invalid foreign key reference' });
    }
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/:id', ensureUser, validateDeleteTask, async (req: AuthedRequest, res: Response) => {
  const taskId = req.params.id;
  const task = await getTaskById(taskId);
  if (!task) return res.status(404).json({ error: 'Not found' });
  const uid2 = req.userId as string;
  const ok = await isProjectEditorOrOwner(task.projectId, uid2);
  if (!ok) return res.status(403).json({ error: 'Forbidden' });
  
  await deleteTask(taskId);
  
  // Broadcast task deletion to other clients
  realtimeService.broadcastTaskUpdate(task, 'deleted');
  
  res.status(204).send();
});

// Task comment endpoints

// GET /tasks/:id/comments - Get all comments for a task
router.get('/:id/comments', ensureUser, async (req: AuthedRequest, res: Response) => {
  try {
    const taskId = req.params.id;
    const userId = req.userId as string;
    
    // Check if user can access this task
    const task = await getTaskById(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    const ok = await isProjectEditorOrOwner(task.projectId, userId);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });
    
    const comments = await getTaskComments(taskId);
    res.json({ comments });
  } catch (error) {
    console.error('Error fetching task comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /tasks/:id/comments - Add a comment to a task
router.post('/:id/comments', ensureUser, async (req: AuthedRequest, res: Response) => {
  try {
    const taskId = req.params.id;
    const userId = req.userId as string;
    const { content } = req.body as { content: string };
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    // Check if user can access this task
    const task = await getTaskById(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    const ok = await isProjectEditorOrOwner(task.projectId, userId);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });
    
    const comment = await createTaskComment(taskId, userId, content.trim());
    res.status(201).json({ comment });
  } catch (error) {
    console.error('Error creating task comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// PUT /tasks/:id/comments/:commentId - Update a comment
router.put('/:id/comments/:commentId', ensureUser, async (req: AuthedRequest, res: Response) => {
  try {
    const taskId = req.params.id;
    const commentId = req.params.commentId;
    const userId = req.userId as string;
    const { content } = req.body as { content: string };
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    // Check if user can access this task
    const task = await getTaskById(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    const ok = await isProjectEditorOrOwner(task.projectId, userId);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });
    
    // Additional check: user can only edit their own comments
    const existingComment = await prisma.taskComment.findUnique({ where: { id: commentId } });
    if (!existingComment) return res.status(404).json({ error: 'Comment not found' });
    if (existingComment.authorId !== userId) return res.status(403).json({ error: 'Can only edit your own comments' });
    
    const comment = await updateTaskComment(commentId, content.trim());
    res.json({ comment });
  } catch (error) {
    console.error('Error updating task comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// DELETE /tasks/:id/comments/:commentId - Delete a comment
router.delete('/:id/comments/:commentId', ensureUser, async (req: AuthedRequest, res: Response) => {
  try {
    const taskId = req.params.id;
    const commentId = req.params.commentId;
    const userId = req.userId as string;
    
    // Check if user can access this task
    const task = await getTaskById(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    const ok = await isProjectEditorOrOwner(task.projectId, userId);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });
    
    // Additional check: user can only delete their own comments
    const existingComment = await prisma.taskComment.findUnique({ where: { id: commentId } });
    if (!existingComment) return res.status(404).json({ error: 'Comment not found' });
    if (existingComment.authorId !== userId) return res.status(403).json({ error: 'Can only delete your own comments' });
    
    await deleteTaskComment(commentId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting task comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
