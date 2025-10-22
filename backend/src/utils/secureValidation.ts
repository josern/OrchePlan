import { Request, Response, NextFunction } from 'express';
import { createComponentLogger } from './logger';

const logger = createComponentLogger('SecureValidation');

/**
 * Secure URL validation that addresses the validator.js vulnerability
 * CVE-2025-56200 / GHSA-9965-vmph-33xx
 * 
 * This implementation uses proper protocol parsing with ':' as delimiter
 * instead of '://' to prevent bypass attacks
 */
export function isSecureURL(value: string, options: {
  allowedProtocols?: string[];
  allowDataUrls?: boolean;
  requireProtocol?: boolean;
} = {}): boolean {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  const {
    allowedProtocols = ['http', 'https'],
    allowDataUrls = false,
    requireProtocol = true
  } = options;

  try {
    // Use native URL constructor which properly handles protocol parsing
    const url = new URL(value);
    
    // Extract protocol without the colon (e.g., 'https' from 'https:')
    const protocol = url.protocol.slice(0, -1);
    
    // Check for data URLs if not allowed
    if (!allowDataUrls && protocol === 'data') {
      return false;
    }
    
    // Validate against allowed protocols
    if (!allowedProtocols.includes(protocol)) {
      return false;
    }
    
    // Additional security checks
    if (protocol === 'javascript') {
      return false; // Prevent XSS
    }
    
    // Check for suspicious patterns that could bypass validation
    if (value.includes('://') && !value.startsWith(`${protocol}://`)) {
      return false; // Prevent protocol confusion attacks
    }
    
    return true;
  } catch (error) {
    // If URL constructor throws, it's not a valid URL
    if (requireProtocol) {
      return false;
    }
    
    // Try with protocol prefix for relative URLs
    try {
      new URL(`https://${value}`);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Express middleware for secure URL validation
 */
export function validateSecureURL(field: string, options?: Parameters<typeof isSecureURL>[1]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];
    
    if (value && !isSecureURL(value, options)) {
      logger.warn('URL validation failed', {
        component: 'secureValidation',
        field,
        value: value.substring(0, 100), // Log only first 100 chars for security
        correlationId: (req as any).correlationId
      });
      
      return res.status(400).json({
        error: 'Invalid input data',
        details: [{
          field,
          message: 'Please provide a valid URL',
          value: undefined // Don't echo back potentially malicious input
        }]
      });
    }
    
    next();
  };
}

/**
 * Secure email validation using built-in checks
 * Replacement for validator.js isEmail to reduce dependency surface
 */
export function isSecureEmail(email: string): boolean {
  if (typeof email !== 'string' || email.length === 0) {
    return false;
  }
  
  // Basic email regex that covers most valid cases
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) {
    return false;
  }
  
  // Additional security checks
  if (email.length > 254) {
    return false; // RFC 5321 limit
  }
  
  const [localPart, domain] = email.split('@');
  if (localPart.length > 64) {
    return false; // RFC 5321 limit
  }
  
  // Prevent header injection attacks
  if (email.includes('\n') || email.includes('\r')) {
    return false;
  }
  
  return true;
}

/**
 * Express middleware for secure email validation
 */
export function validateSecureEmail(field: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];
    
    if (value && !isSecureEmail(value)) {
      logger.warn('Email validation failed', {
        component: 'secureValidation',
        field,
        correlationId: (req as any).correlationId
      });
      
      return res.status(400).json({
        error: 'Invalid input data',
        details: [{
          field,
          message: 'Please provide a valid email address',
          value: undefined
        }]
      });
    }
    
    next();
  };
}