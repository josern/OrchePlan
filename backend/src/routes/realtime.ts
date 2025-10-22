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
    
    // Get all project IDs the user has access to
    const projects = await getProjectsForUser(userId);
    const projectIds = projects.map((p: any) => p.id);
    
    
    // Add client to realtime service
    realtimeService.addClient(clientId, userId, res, projectIds);
    
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

export default router;