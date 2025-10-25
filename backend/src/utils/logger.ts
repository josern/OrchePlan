import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

// Log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  userId?: string;
  projectId?: string;
  taskId?: string;
  component?: string;
  action?: string;
  correlationId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number | string;
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
  environment: string;
  service: string;
}

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFileLogging: boolean;
  logDir: string;
  maxFileSize: number; // in MB
  maxFiles: number;
  service: string;
}

class BackendLogger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;
  private globalContext: LogContext = {};
  private parentContext: LogContext = {};

  constructor(config?: Partial<LoggerConfig>, parentContext: LogContext = {}) {
    this.config = {
      level: 'info',
      enableConsole: true,
      enableFileLogging: true,
      logDir: path.join(process.cwd(), 'logs'),
      maxFileSize: 10, // 10MB
      maxFiles: 5,
      service: 'orcheplan-backend',
      ...config,
    };
    this.parentContext = parentContext;
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    if (this.config.enableFileLogging && !fs.existsSync(this.config.logDir)) {
      try {
        fs.mkdirSync(this.config.logDir, { recursive: true });
      } catch (error) {
        console.error('Failed to create log directory:', error);
        this.config.enableFileLogging = false;
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatForConsole(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const mergedContext = this.sanitizeContext({ ...this.globalContext, ...this.parentContext, ...context });
    
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
    if (mergedContext.method && mergedContext.url) {
      prefix += ` [${mergedContext.method} ${mergedContext.url}]`;
    }
    if (mergedContext.action) {
      prefix += ` [${mergedContext.action}]`;
    }
    if (mergedContext.correlationId) {
      prefix += ` [ID:${mergedContext.correlationId}]`;
    }
    
    return `${prefix} ${message}`;
  }

  private createLogEntry(level: LogLevel, message: string, context?: LogContext, ...args: any[]): LogEntry {
    const timestamp = new Date().toISOString();
    const mergedContext = this.sanitizeContext({ ...this.globalContext, ...this.parentContext, ...context });
    
    const logEntry: LogEntry = {
      level,
      message,
      timestamp,
      context: mergedContext,
      args: args.length > 0 ? args : undefined,
      environment: process.env.NODE_ENV || 'development',
      service: this.config.service,
    };

    // Add error details if present
    if (args.length > 0 && args[0] instanceof Error) {
      logEntry.error = {
        name: args[0].name,
        message: args[0].message,
        stack: args[0].stack,
      };
    }

    return logEntry;
  }

  private addToBuffer(entry: LogEntry) {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift(); // Remove oldest entry
    }
  }

  private writeToConsole(entry: LogEntry, ...args: any[]) {
    if (!this.config.enableConsole) return;

    const formattedMessage = this.formatForConsole(entry.level, entry.message, entry.context);

    // If consumer requested JSON logs for console, print the raw entry as JSON
    if (process.env.LOG_JSON === 'true') {
      try {
        // Print compact JSON to console
        console.log(JSON.stringify(entry));
      } catch (e) {
        // fallback to human readable
        console.log(formattedMessage, ...args);
      }
      return;
    }

    switch (entry.level) {
      case 'debug':
        console.debug(formattedMessage, ...args);
        break;
      case 'info':
        console.info(formattedMessage, ...args);
        break;
      case 'warn':
        console.warn(formattedMessage, ...args);
        if (entry.context && Object.keys(entry.context).length > 0) {
          console.warn('Context:', entry.context);
        }
        break;
      case 'error':
        console.error(formattedMessage, ...args);
        if (entry.context && Object.keys(entry.context).length > 0) {
          console.error('Context:', entry.context);
        }
        if (entry.error?.stack) {
          console.error('Stack trace:', entry.error.stack);
        }
        break;
    }
  }

  private async writeToFile(entry: LogEntry) {
    if (!this.config.enableFileLogging) return;

    try {
      const logFileName = `${entry.level}-${new Date().toISOString().split('T')[0]}.log`;
      const logFilePath = path.join(this.config.logDir, logFileName);
      
      const logLine = JSON.stringify(entry) + '\n';
      
      // Check file size and rotate if necessary
      await this.rotateLogFileIfNeeded(logFilePath);
      
      // Append to log file
      await fs.promises.appendFile(logFilePath, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private async rotateLogFileIfNeeded(filePath: string) {
    try {
      const stats = await fs.promises.stat(filePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      if (fileSizeMB > this.config.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = filePath.replace('.log', `-${timestamp}.log`);
        await fs.promises.rename(filePath, rotatedPath);
        await this.cleanupOldLogFiles(path.dirname(filePath));
      }
    } catch (error) {
      // File doesn't exist yet, no rotation needed
    }
  }

  private async cleanupOldLogFiles(logDir: string) {
    try {
      const files = await fs.promises.readdir(logDir);
      const logFiles = files.filter(file => file.endsWith('.log')).sort();
      
      if (logFiles.length > this.config.maxFiles) {
        const filesToDelete = logFiles.slice(0, logFiles.length - this.config.maxFiles);
        for (const file of filesToDelete) {
          await fs.promises.unlink(path.join(logDir, file));
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext, ...args: any[]) {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, context, ...args);
    this.addToBuffer(entry);
    this.writeToConsole(entry, ...args);
    this.writeToFile(entry);
  }

  // Redact potentially sensitive fields from context before persisting/printing
  private sanitizeContext(ctx?: LogContext): LogContext {
    if (!ctx) return {};
    const redacted = { ...ctx } as LogContext;
    const sensitiveKeys = ['password', 'pass', 'pwd', 'token', 'authorization', 'secret', 'apiKey', 'apikey', 'accessToken', 'refreshToken', 'newPassword'];
    for (const k of Object.keys(redacted)) {
      const lower = k.toLowerCase();
      if (sensitiveKeys.includes(lower) || sensitiveKeys.some(s => lower.includes(s))) {
        redacted[k] = '[REDACTED]';
      }
    }
    return redacted;
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

  setContext(context: LogContext): BackendLogger {
    this.globalContext = { ...this.globalContext, ...context };
    return this;
  }

  withContext(context: LogContext): BackendLogger {
    return new BackendLogger(this.config, { ...this.parentContext, ...context });
  }

  // Get recent logs for debugging
  getRecentLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  // Clear log buffer
  clearLogs() {
    this.logBuffer = [];
  }

  // Get logger statistics
  getStats() {
    const levelCounts = this.logBuffer.reduce((acc, entry) => {
      acc[entry.level] = (acc[entry.level] || 0) + 1;
      return acc;
    }, {} as Record<LogLevel, number>);

    return {
      totalLogs: this.logBuffer.length,
      levelCounts,
      config: this.config,
    };
  }
}

// Create singleton logger instance
// Create singleton logger instance. Prefer pino when enabled/available for
// production-grade structured logging; otherwise fall back to the built-in
// BackendLogger implementation.
let logger: any;
const desiredLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const usePino = process.env.USE_PINO === 'true';
if (usePino) {
    try {
      // Dynamically require pino so this file can still be imported when pino is
      // not installed (e.g., in lightweight dev). If pino is present, create a
      // thin wrapper that matches the shape used by the codebase.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pino = require('pino');

      // If file logging is enabled, create a pino destination to a daily log
      // file so logs are persisted to disk similar to the old BackendLogger.
      let p: any;
      try {
        const enableFile = process.env.LOG_FILE !== 'false';
        if (enableFile) {
          const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
          try { fs.mkdirSync(logDir, { recursive: true }); } catch (e) {}
          const filePath = path.join(logDir, `pino-${new Date().toISOString().split('T')[0]}.log`);
          const dest = pino.destination(filePath);
          p = pino({ name: 'orcheplan-backend', level: desiredLevel }, dest);
        } else {
          p = pino({ name: 'orcheplan-backend', level: desiredLevel });
        }
      } catch (e) {
        // If destination creation failed, fall back to stdout pino instance
        p = pino({ name: 'orcheplan-backend', level: desiredLevel });
      }

      const makeWrapper = (instance: any) => ({
        debug: instance.debug.bind(instance),
        info: instance.info.bind(instance),
        warn: instance.warn.bind(instance),
        error: instance.error.bind(instance),
        setContext: (_ctx: LogContext) => makeWrapper(instance),
        withContext: (ctx: LogContext) => makeWrapper(instance.child ? instance.child(ctx) : instance),
        getRecentLogs: () => [],
        clearLogs: () => {},
        getStats: () => ({ totalLogs: 0, levelCounts: {}, config: {} }),
      });

      logger = makeWrapper(p);
    } catch (e) {
      // pino not available; fall back
      logger = new BackendLogger({
        level: desiredLevel,
        enableConsole: process.env.LOG_CONSOLE !== 'false',
        enableFileLogging: process.env.LOG_FILE !== 'false',
        logDir: process.env.LOG_DIR || path.join(process.cwd(), 'logs'),
      });
    }
} else {
  logger = new BackendLogger({
    level: desiredLevel,
    enableConsole: process.env.LOG_CONSOLE !== 'false',
    enableFileLogging: process.env.LOG_FILE !== 'false',
    logDir: process.env.LOG_DIR || path.join(process.cwd(), 'logs'),
  });
}

export { logger };

// Helper function to generate correlation IDs
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to create component-specific loggers
export function createComponentLogger(componentName: string): BackendLogger {
  return logger.withContext({ component: componentName });
}

// Helper function to measure execution time
export function measureTime<T>(
  operation: string,
  fn: () => T,
  context?: LogContext
): T {
  const start = Date.now();
  const correlationId = generateCorrelationId();
  const componentLogger = logger.withContext({ ...context, correlationId });
  
  componentLogger.debug(`Starting ${operation}`);
  
  try {
    const result = fn();
    const duration = Date.now() - start;
    componentLogger.info(`Completed ${operation}`, { duration: `${duration}ms` });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    componentLogger.error(`Failed ${operation}`, { duration: `${duration}ms` }, error);
    throw error;
  }
}

// Helper function to measure async execution time
export async function measureTimeAsync<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const start = Date.now();
  const correlationId = generateCorrelationId();
  const componentLogger = logger.withContext({ ...context, correlationId });
  
  componentLogger.debug(`Starting ${operation}`);
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    componentLogger.info(`Completed ${operation}`, { duration: `${duration}ms` });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    componentLogger.error(`Failed ${operation}`, { duration: `${duration}ms` }, error);
    throw error;
  }
}

// Express middleware for request logging
export function requestLoggingMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    const correlationId = generateCorrelationId();
    
    // Add correlation ID to request for use in other middleware/routes
    req.correlationId = correlationId;
    
    const requestLogger = logger.withContext({
      correlationId,
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
    });

    requestLogger.info('Incoming request');

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - start;
      requestLogger.info('Request completed', {
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    });

    next();
  };
}

export default logger;