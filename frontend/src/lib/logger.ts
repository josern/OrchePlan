// Centralized logging utility for frontend
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  userId?: string;
  projectId?: string;
  taskId?: string;
  component?: string;
  action?: string;
  correlationId?: string;
  timestamp?: string;
  [key: string]: any;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  args?: any[];
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

interface Logger {
  debug: (message: string, context?: LogContext, ...args: any[]) => void;
  info: (message: string, context?: LogContext, ...args: any[]) => void;
  warn: (message: string, context?: LogContext, ...args: any[]) => void;
  error: (message: string, context?: LogContext, ...args: any[]) => void;
  setContext: (context: LogContext) => Logger;
  withContext: (context: LogContext) => Logger;
}

class EnhancedLogger implements Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private globalContext: LogContext = {};
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 100;

  constructor(private parentContext: LogContext = {}) {}

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const mergedContext = { ...this.globalContext, ...this.parentContext, ...context };
    
    let prefix = `[${level.toUpperCase()}] ${timestamp}`;
    
    // Add context information to prefix
    if (mergedContext.component) {
      prefix += ` [${mergedContext.component}]`;
    }
    if (mergedContext.userId) {
      prefix += ` [User:${mergedContext.userId}]`;
    }
    if (mergedContext.projectId) {
      prefix += ` [Project:${mergedContext.projectId}]`;
    }
    if (mergedContext.action) {
      prefix += ` [${mergedContext.action}]`;
    }
    if (mergedContext.correlationId) {
      prefix += ` [ID:${mergedContext.correlationId}]`;
    }
    
    return `${prefix} ${message}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext, ...args: any[]) {
    const timestamp = new Date().toISOString();
    
    // In production, only log warnings and errors
    if (process.env.NODE_ENV === 'production' && level !== 'warn' && level !== 'error') {
      return;
    }
    
    // Safely merge context objects
    const safeGlobalContext = this.globalContext || {};
    const safeParentContext = this.parentContext || {};
    const safeContext = context || {};
    
    const mergedContext = { ...safeGlobalContext, ...safeParentContext, ...safeContext };
    
    // Filter out undefined, null, and empty string values from context
    const filteredContext = Object.fromEntries(
      Object.entries(mergedContext).filter(([key, value]) => {
        return value !== undefined && value !== null && value !== '';
      })
    );
    
    // Create log entry for buffer
    const logEntry: LogEntry = {
      level,
      message,
      timestamp,
      context: filteredContext,
      args: args.length > 0 ? args : undefined,
    };

    // Add error details if present
    if (args.length > 0 && args[0] instanceof Error) {
      logEntry.error = {
        name: args[0].name,
        message: args[0].message,
        stack: args[0].stack,
      };
    }

    // Add to buffer
    this.addToBuffer(logEntry);

    // Format message for console
    const formattedMessage = this.formatMessage(level, message, filteredContext);

    // Helper to check if context has meaningful content
    const hasContext = Object.keys(filteredContext).length > 0;
    
    // Console output based on level and environment
    switch (level) {
      case 'debug':
        if (this.isDevelopment) {
          if (hasContext) {
          }
        }
        break;
      case 'info':
        if (this.isDevelopment) {
          console.info(formattedMessage, ...args);
          if (hasContext) {
            console.info('Context:', filteredContext);
          }
        }
        break;
      case 'warn':
        console.warn(formattedMessage, ...args);
        if (hasContext) {
          console.warn('Context:', filteredContext);
        }
        break;
      case 'error':
        console.error(formattedMessage, ...args);
        if (hasContext) {
          console.error('Context:', filteredContext);
        } else if (this.isDevelopment) {
          // In development, show when context was intentionally omitted vs empty
        }
        // In development, also show stack trace for unexpected errors only
        if (this.isDevelopment && args.length > 0) {
          args.forEach(arg => {
            if (arg instanceof Error && arg.stack && !(arg as any).isExpected) {
              console.error('Stack trace:', arg.stack);
            }
          });
        }
        break;
    }

    // Send to external logging service in production
    if (!this.isDevelopment && level === 'error') {
      this.sendToExternalLogging(logEntry);
    }
  }

  private addToBuffer(entry: LogEntry) {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift(); // Remove oldest entry
    }
  }

  private async sendToExternalLogging(entry: LogEntry) {
    // This would integrate with external logging services like LogRocket, Sentry, etc.
    // For now, just store in localStorage for debugging
    try {
      const existingLogs = JSON.parse(localStorage.getItem('orcheplan_error_logs') || '[]');
      existingLogs.push(entry);
      // Keep only last 50 error logs
      if (existingLogs.length > 50) {
        existingLogs.splice(0, existingLogs.length - 50);
      }
      localStorage.setItem('orcheplan_error_logs', JSON.stringify(existingLogs));
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  debug(message: string, context?: LogContext, ...args: any[]) {
    this.log('debug', message, context, ...args);
  }

  info(message: string, context?: LogContext, ...args: any[]) {
    this.log('info', message, context, ...args);
  }

  warn(message: string, context?: LogContext, ...args: any[]) {
    this.log('warn', message, context, ...args);
  }

  error(message: string, context?: LogContext, ...args: any[]) {
    this.log('error', message, context, ...args);
  }

  setContext(context: LogContext): Logger {
    this.globalContext = { ...this.globalContext, ...context };
    return this;
  }

  withContext(context: LogContext): Logger {
    return new EnhancedLogger({ ...this.parentContext, ...context });
  }

  // Get recent logs for debugging
  getRecentLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  // Clear log buffer
  clearLogs() {
    this.logBuffer = [];
  }

  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2);
  }
}

// Create singleton logger instance
export const logger = new EnhancedLogger();

// Helper function to generate correlation IDs
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to create component-specific loggers
export function createComponentLogger(componentName: string): Logger {
  return logger.withContext({ component: componentName });
}

// Helper function to measure execution time
export function measureTime<T>(
  operation: string,
  fn: () => T,
  context?: LogContext
): T {
  const start = performance.now();
  const correlationId = generateCorrelationId();
  const componentLogger = logger.withContext({ ...context, correlationId });
  
  componentLogger.debug(`Starting ${operation}`);
  
  try {
    const result = fn();
    const duration = performance.now() - start;
    componentLogger.info(`Completed ${operation}`, { duration: `${duration.toFixed(2)}ms` });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    componentLogger.error(`Failed ${operation}`, { duration: `${duration.toFixed(2)}ms` }, error);
    throw error;
  }
}

// Helper function to measure async execution time
export async function measureTimeAsync<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const start = performance.now();
  const correlationId = generateCorrelationId();
  const componentLogger = logger.withContext({ ...context, correlationId });
  
  componentLogger.debug(`Starting ${operation}`);
  
  try {
    const result = await fn();
    const duration = performance.now() - start;
    componentLogger.info(`Completed ${operation}`, { duration: `${duration.toFixed(2)}ms` });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    componentLogger.error(`Failed ${operation}`, { duration: `${duration.toFixed(2)}ms` }, error);
    throw error;
  }
}