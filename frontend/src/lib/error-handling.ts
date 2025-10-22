import { logger } from './logger';

export interface ErrorContext {
  component?: string;
  action?: string;
  taskId?: string;
  projectId?: string;
  userId?: string;
}

export class AppError extends Error {
  public readonly context: ErrorContext;
  public readonly timestamp: Date;

  constructor(message: string, context: ErrorContext = {}) {
    super(message);
    this.name = 'AppError';
    this.context = context;
    this.timestamp = new Date();
  }
}

export function handleError(error: unknown, context: ErrorContext = {}): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  
  logger.error(`Error in ${context.component || 'Unknown Component'}`, {
    message: errorMessage,
    action: context.action,
    context,
    timestamp: new Date().toISOString(),
    stack: error instanceof Error ? error.stack : undefined
  });

  // In development, also show in console for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('Message:', errorMessage);
    console.error('Context:', context);
    console.error('Original Error:', error);
  }
}

export function handleAsyncError(
  promise: Promise<any>,
  context: ErrorContext = {}
): Promise<any> {
  return promise.catch(error => {
    handleError(error, context);
    throw error; // Re-throw so caller can handle UI state
  });
}