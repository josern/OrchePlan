import express, { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { realtimeService } from '../services/realtime';
import { getProjectsForUser } from '../services/sqlClient';

const router = Router();

// Add specific CORS handling for SSE
router.use((req: Request, res: Response, next: NextFunction) => {
  // Set CORS headers specifically for SSE
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With, X-CSRF-Token, Cache-Control, Connection, Keep-Alive, Upgrade, Accept-Encoding, Accept-Language, User-Agent');
    res.header('Access-Control-Expose-Headers', 'Content-Type, Cache-Control, Connection');
  }
  
  // Handle preflight for SSE
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// SSE endpoint for real-time updates
router.get('/events', authMiddleware, async (req: any, res: Response) => {
  try {
    
    const userId = req.user.id;
    const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
  // For project-scoped subscriptions we'll start with no project subscriptions.
  // The client will call /realtime/subscribe after connection to subscribe to a specific project.
  realtimeService.addClient(clientId, userId, res, []);
    
  } catch (error) {
    console.error('[SSE] Error setting up client:', error);
    res.status(500).json({ error: 'Failed to establish SSE connection' });
  }
});

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  const stats = realtimeService.getStats();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    endpoint: '/realtime/events',
    ...stats
  });
});

// Simple test endpoint
router.get('/test', (req: Request, res: Response) => {
  res.json({
    message: 'SSE endpoint is accessible',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']
  });
});

// Test broadcast endpoint for debugging (only in development)
router.post('/test-broadcast', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Test broadcasts disabled in production' });
  }
  
  const { projectId, type = 'task_update', action = 'updated' } = req.body;
  
  if (!projectId) {
    return res.status(400).json({ error: 'projectId required' });
  }
  
  // Send test message
  const testEvent = {
    type,
    action,
    data: {
      id: 'test-' + Date.now(),
      projectId,
      title: 'Test SSE Message',
      description: 'This is a test message for SSE debugging'
    },
    timestamp: new Date().toISOString()
  };
  
  const stats = realtimeService.getStats();
  
  // Broadcast test message
  if (type === 'task_update') {
    realtimeService.broadcastTaskUpdate(testEvent.data, action as any);
  }
  
  res.json({
    message: 'Test broadcast sent',
    event: testEvent,
    stats,
    timestamp: new Date().toISOString()
  });
});

// Subscribe client to a project channel
router.post('/subscribe', authMiddleware, async (req: any, res: Response) => {
  try {
    const { clientId, projectId } = req.body;
    if (!clientId || !projectId) return res.status(400).json({ error: 'clientId and projectId required' });

    // Authenticated user id
    const userId = req.user?.id;

    // Verify that the clientId belongs to the authenticated user
    const ownerId = realtimeService.getClientUserId(clientId);
    if (!ownerId || ownerId !== userId) return res.status(403).json({ error: 'clientId does not belong to authenticated user' });

    // Verify that the authenticated user actually has access to the project
    try {
      const userProjects = await getProjectsForUser(userId);
      const hasAccess = Array.isArray(userProjects) && userProjects.some((p: any) => p.id === projectId);
      if (!hasAccess) return res.status(403).json({ error: 'user does not have access to project' });
    } catch (err) {
      console.error('Error verifying project access for subscribe', err);
      return res.status(500).json({ error: 'failed to verify project access' });
    }

    const success = realtimeService.subscribeClientToProject(clientId, projectId);
    if (!success) return res.status(404).json({ error: 'client not found' });
    return res.json({ success: true, clientId, projectId });
  } catch (error) {
    console.error('Error subscribing client to project', error);
    return res.status(500).json({ error: 'subscribe failed' });
  }
});

// Unsubscribe client from a project channel
router.post('/unsubscribe', authMiddleware, async (req: any, res: Response) => {
  try {
    const { clientId, projectId } = req.body;
    if (!clientId || !projectId) return res.status(400).json({ error: 'clientId and projectId required' });

    // Authenticated user id
    const userId = req.user?.id;

    // Verify that the clientId belongs to the authenticated user
    const ownerId = realtimeService.getClientUserId(clientId);
    if (!ownerId || ownerId !== userId) return res.status(403).json({ error: 'clientId does not belong to authenticated user' });

    // Verify that the authenticated user actually has access to the project
    try {
      const userProjects = await getProjectsForUser(userId);
      const hasAccess = Array.isArray(userProjects) && userProjects.some((p: any) => p.id === projectId);
      if (!hasAccess) return res.status(403).json({ error: 'user does not have access to project' });
    } catch (err) {
      console.error('Error verifying project access for unsubscribe', err);
      return res.status(500).json({ error: 'failed to verify project access' });
    }

    const success = realtimeService.unsubscribeClientFromProject(clientId, projectId);
    if (!success) return res.status(404).json({ error: 'client not found' });
    return res.json({ success: true, clientId, projectId });
  } catch (error) {
    console.error('Error unsubscribing client from project', error);
    return res.status(500).json({ error: 'unsubscribe failed' });
  }
});

// List subscriptions for a client (dev+prod) - returns array of projectIds
router.get('/subscriptions', authMiddleware, async (req: any, res: Response) => {
  try {
    const clientId = String(req.query.clientId || req.body?.clientId || '');
    if (!clientId) return res.status(400).json({ error: 'clientId required' });

    // Authenticated user id
    const userId = req.user?.id;

    // Verify ownership
    const ownerId = realtimeService.getClientUserId(clientId);
    if (!ownerId || ownerId !== userId) return res.status(403).json({ error: 'clientId does not belong to authenticated user' });

    const subs = realtimeService.getClientSubscriptions(clientId);
    if (!subs) return res.status(404).json({ error: 'client not found' });

    return res.json({ clientId, projects: subs });
  } catch (error) {
    console.error('Error listing subscriptions', error);
    return res.status(500).json({ error: 'failed to list subscriptions' });
  }
});

export default router;