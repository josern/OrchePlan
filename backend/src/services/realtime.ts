import { Response } from 'express';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('RealtimeService');

interface Client {
  id: string;
  userId: string;
  res: Response;
  projectIds: string[];
}

class RealtimeService {
  private clients: Map<string, Client> = new Map();

  // Add a client connection
  addClient(clientId: string, userId: string, res: Response, projectIds: string[]) {
    logger.info('Setting up SSE client connection', {
      clientId,
      userId,
      projectIds,
      projectCount: projectIds.length
    });
    
    // Set up SSE headers before storing the client
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin') || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, Authorization',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'Transfer-Encoding': 'chunked'
    });

    // Store client info
    this.clients.set(clientId, { id: clientId, userId, res, projectIds });
    
    // Send initial connection confirmation
    const welcomeMessage = JSON.stringify({ 
      type: 'connected', 
      clientId, 
      userId,
      projectIds,
      timestamp: new Date().toISOString()
    });
    
    try {
      res.write(`data: ${welcomeMessage}\n\n`);
      logger.debug('Sent welcome message to client', { clientId });
    } catch (error) {
      logger.error('Error sending welcome message to client', { clientId }, error);
      this.removeClient(clientId);
      return;
    }

    // Send periodic heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
      } catch (error) {
        logger.warn('Heartbeat failed for client', { clientId }, error);
        clearInterval(heartbeatInterval);
        this.removeClient(clientId);
      }
    }, 30000); // Every 30 seconds

    // Handle client disconnect
    res.on('close', () => {
      logger.info('Client disconnected (close event)', { clientId, userId });
      clearInterval(heartbeatInterval);
      this.removeClient(clientId);
    });

    res.on('error', (error) => {
      logger.error('SSE client error', { clientId, userId }, error);
      clearInterval(heartbeatInterval);
      this.removeClient(clientId);
    });

    res.on('finish', () => {
      logger.info('Client connection finished', { clientId, userId });
      clearInterval(heartbeatInterval);
      this.removeClient(clientId);
    });

    logger.info('SSE client successfully connected', { clientId, userId, projectCount: projectIds.length });
  }

  // Remove a client connection
  removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      logger.debug('Client removed from active connections', { 
        clientId, 
        userId: client.userId,
        remainingClients: this.clients.size 
      });
    }
  }

  // Broadcast task updates to relevant clients
  broadcastTaskUpdate(task: any, action: 'created' | 'updated' | 'deleted') {
    const event = {
      type: 'task_update',
      action,
      data: task,
      timestamp: new Date().toISOString()
    };

    this.broadcastToProject(task.projectId, event);
  }

  // Broadcast project updates to relevant clients
  broadcastProjectUpdate(project: any, action: 'created' | 'updated' | 'deleted') {
    const event = {
      type: 'project_update',
      action,
      data: project,
      timestamp: new Date().toISOString()
    };

    this.broadcastToProject(project.id, event);
    
    // Also broadcast to parent project if this is a subproject
    if (project.parentProjectId) {
      this.broadcastToProject(project.parentProjectId, event);
    }
  }

  // Broadcast status updates to relevant clients
  broadcastStatusUpdate(status: any, projectId: string, action: 'created' | 'updated' | 'deleted') {
    const event = {
      type: 'status_update',
      action,
      data: status,
      projectId,
      timestamp: new Date().toISOString()
    };

    this.broadcastToProject(projectId, event);
  }

  // Broadcast to all clients interested in a specific project
  private broadcastToProject(projectId: string, event: any) {
    let sentCount = 0;
    
    this.clients.forEach(client => {
      // Send to clients who have access to this project
      if (client.projectIds.includes(projectId)) {
        try {
          client.res.write(`data: ${JSON.stringify(event)}\n\n`);
          sentCount++;
        } catch (error) {
          logger.error('Error sending event to client', { 
            clientId: client.id, 
            userId: client.userId,
            eventType: event.type 
          }, error);
          this.removeClient(client.id);
        }
      }
    });

    // Only log if no events were sent (potential issue)
    if (sentCount === 0 && this.clients.size > 0) {
      logger.warn('No clients received event for project', {
        eventType: event.type,
        projectId,
        action: event.action,
        totalClients: this.clients.size
      });
    }
  }

  // Get stats about connected clients
  getStats() {
    return {
      totalClients: this.clients.size,
      clientsByUser: Array.from(this.clients.values()).reduce((acc, client) => {
        acc[client.userId] = (acc[client.userId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

// Singleton instance
export const realtimeService = new RealtimeService();