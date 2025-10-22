# OrchePlan Logging System

This document describes the comprehensive logging system implemented in OrchePlan, covering both frontend and backend logging capabilities.

## Overview

The logging system provides structured, contextual logging with different levels and flexible configuration for both development and production environments.

## Features

- **Structured Logging**: JSON-formatted logs with contextual metadata
- **Log Levels**: Debug, Info, Warn, Error with environment-aware filtering
- **Context Propagation**: Automatic correlation IDs and contextual information
- **Performance Monitoring**: Built-in execution time measurement
- **Error Tracking**: Enhanced error logging with stack traces
- **File Logging**: Backend log persistence with rotation (backend only)
- **Development Tools**: Enhanced console output and log buffering

## Frontend Logger (`/frontend/src/lib/logger.ts`)

### Basic Usage

```typescript
import { logger, createComponentLogger } from '@/lib/logger';

// Basic logging
logger.info('User action completed');
logger.error('Operation failed', { userId: '123' }, error);

// Component-specific logger
const componentLogger = createComponentLogger('UserProfile');
componentLogger.debug('Component mounted');
```

### Advanced Features

```typescript
// Context propagation
const contextLogger = logger.withContext({ 
  userId: '123', 
  projectId: 'proj-456' 
});
contextLogger.info('User updated project');

// Performance measurement
import { measureTimeAsync } from '@/lib/logger';

const result = await measureTimeAsync('API Call', async () => {
  return await api.getData();
}, { userId: '123' });
```

### Log Context Fields

- `userId`: Current user ID
- `projectId`: Current project ID
- `taskId`: Current task ID
- `component`: React component name
- `action`: Action being performed
- `correlationId`: Unique identifier for request tracing

### Environment Behavior

- **Development**: All logs shown in console with full context
- **Production**: Only warn/error logs shown, errors stored in localStorage

## Backend Logger (`/backend/src/utils/logger.ts`)

### Basic Usage

```typescript
import { logger, createComponentLogger } from '../utils/logger';

// Basic logging
logger.info('Server started', { port: 3000 });
logger.error('Database connection failed', { database: 'postgres' }, error);

// Component-specific logger
const dbLogger = createComponentLogger('DatabaseService');
dbLogger.debug('Query executed', { query: 'SELECT * FROM users' });
```

### Request Logging Middleware

```typescript
import { requestLoggingMiddleware } from '../utils/logger';

// In your Express app
app.use(requestLoggingMiddleware());
```

This automatically logs:
- Incoming requests with method, URL, IP, User-Agent
- Response completion with status code and duration
- Correlation IDs for request tracing

### File Logging

Logs are automatically written to files in the `logs/` directory:
- `debug-YYYY-MM-DD.log`: Debug level logs
- `info-YYYY-MM-DD.log`: Info level logs  
- `warn-YYYY-MM-DD.log`: Warning logs
- `error-YYYY-MM-DD.log`: Error logs

#### Log Rotation

- Files are rotated when they exceed 10MB (configurable)
- Old files are kept with timestamps
- Maximum of 5 files per level (configurable)

## Configuration

### Backend Environment Variables

```bash
# Log level (debug, info, warn, error)
LOG_LEVEL=info

# Enable/disable console logging
LOG_CONSOLE=true

# Enable/disable file logging
LOG_FILE=true

# Log directory path
LOG_DIR=./logs
```

### Logger Configuration

```typescript
// Backend logger configuration
const logger = new BackendLogger({
  level: 'info',
  enableConsole: true,
  enableFileLogging: true,
  logDir: './logs',
  maxFileSize: 10, // MB
  maxFiles: 5,
  service: 'orcheplan-backend'
});
```

## Integration Examples

### Component Logger

```typescript
// React component
import { createComponentLogger } from '@/lib/logger';

const logger = createComponentLogger('TaskItem');

export function TaskItem({ task }) {
  useEffect(() => {
    logger.debug('Task item mounted', { taskId: task.id });
  }, []);

  const handleUpdate = async () => {
    try {
      logger.info('Updating task', { taskId: task.id, action: 'update' });
      await updateTask(task);
      logger.info('Task updated successfully', { taskId: task.id });
    } catch (error) {
      logger.error('Failed to update task', { taskId: task.id }, error);
    }
  };
}
```

### API Route Logger

```typescript
// Express route
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('TasksController');

router.post('/tasks', async (req, res) => {
  const userId = req.userId; // From auth middleware
  const correlationId = req.correlationId; // From request middleware
  
  logger.info('Creating new task', { 
    userId, 
    correlationId,
    action: 'create_task' 
  });

  try {
    const task = await createTask(req.body);
    logger.info('Task created successfully', { 
      userId, 
      taskId: task.id,
      correlationId 
    });
    res.json(task);
  } catch (error) {
    logger.error('Failed to create task', { 
      userId, 
      correlationId 
    }, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## Log Analysis

### Frontend Debug Tools

```typescript
// Get recent logs for debugging
const recentLogs = logger.getRecentLogs();
console.table(recentLogs);

// Export logs for analysis
const logData = logger.exportLogs();
console.log(logData);

// Access error logs stored in localStorage
const errorLogs = JSON.parse(localStorage.getItem('orcheplan_error_logs') || '[]');
```

### Backend Log Analysis

```bash
# View recent error logs
tail -f logs/error-$(date +%Y-%m-%d).log

# Search for specific user activity
grep "userId.*user-123" logs/info-$(date +%Y-%m-%d).log

# Find slow operations
grep "duration.*[5-9][0-9][0-9]ms" logs/info-$(date +%Y-%m-%d).log
```

## Best Practices

1. **Use appropriate log levels**:
   - `debug`: Detailed diagnostic information
   - `info`: General operational information
   - `warn`: Potentially harmful situations
   - `error`: Error events that should be investigated

2. **Include context**: Always provide relevant context like user ID, project ID, etc.

3. **Use component loggers**: Create component-specific loggers for better organization

4. **Measure performance**: Use the timing utilities for operations that might be slow

5. **Don't log sensitive data**: Avoid logging passwords, tokens, or personal information

6. **Use correlation IDs**: For tracing requests across services

## Troubleshooting

### Common Issues

1. **Logs not appearing**: Check log level configuration
2. **File logging not working**: Ensure write permissions to log directory
3. **Performance impact**: Adjust log level in production environments

### Debug Mode

Enable debug logging in development:

```bash
# Backend
LOG_LEVEL=debug

# Frontend (automatic in development mode)
NODE_ENV=development
```

## Future Enhancements

- External logging service integration (LogRocket, Sentry)
- Log aggregation and search capabilities  
- Metrics and alerting based on log patterns
- Structured error reporting with user feedback