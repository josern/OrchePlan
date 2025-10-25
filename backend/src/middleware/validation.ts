import { Request, Response, NextFunction } from 'express';
import { createComponentLogger } from '../utils/logger';
import { isSecureEmail } from '../utils/secureValidation';

const logger = createComponentLogger('SecureValidationMiddleware');

// Interface for validation errors
interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Middleware to handle validation errors
export const handleValidationErrors = (errors: ValidationError[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (errors.length > 0) {
      logger.warn('Input validation failed', {
        component: 'secureValidation',
        method: req.method,
        url: req.url,
        errors: errors,
        correlationId: (req as any).correlationId
      });

      return res.status(400).json({
        error: 'Invalid input data',
        details: errors.map(error => ({
          field: error.field,
          message: error.message,
          value: undefined // Don't echo back potentially malicious input
        }))
      });
    }
    next();
  };
};

// Validation functions
class SecureValidation {
  static validateUUID(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  static validateEmail(value: string): boolean {
    return isSecureEmail(value);
  }

  static validatePassword(value: string): boolean {
    return value.length >= 8 && value.length <= 128 &&
           /(?=.*[a-z])/.test(value) &&
           /(?=.*[A-Z])/.test(value) &&
           /(?=.*\d)/.test(value);
  }

  static validateName(value: string): boolean {
    return value.length >= 1 && value.length <= 100 &&
           /^[a-zA-Z0-9\s\-_'.]+$/.test(value);
  }

  static validateProjectName(value: string): boolean {
    return value.length >= 1 && value.length <= 200 &&
           /^[a-zA-Z0-9\s\-_'.()]+$/.test(value);
  }

  static validateDescription(value: string): boolean {
    return value.length <= 2000;
  }

  static validateTaskTitle(value: string): boolean {
    return value.length >= 1 && value.length <= 500;
  }

  static validateStatusLabel(value: string): boolean {
    return value.length >= 1 && value.length <= 50 &&
           /^[a-zA-Z0-9\s\-_'.]+$/.test(value);
  }

  static validateColor(value: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value);
  }

  static validateOrder(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= 1000;
  }

  static validateRole(value: string): boolean {
    return ['user', 'admin', 'superuser'].includes(value);
  }
}

// Create validation middleware
export function createSecureValidation(rules: Array<{
  field: string;
  source: 'body' | 'params' | 'query';
  required?: boolean;
  type: 'string' | 'number' | 'boolean' | 'email' | 'uuid' | 'password' | 'name' | 
        'projectName' | 'description' | 'taskTitle' | 'statusLabel' | 'color' | 'order' | 'role';
  maxLength?: number;
  minLength?: number;
  optional?: boolean;
}>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: ValidationError[] = [];

    for (const rule of rules) {
      const sourceData = rule.source === 'body' ? req.body : 
                        rule.source === 'params' ? req.params : req.query;
      const value = sourceData[rule.field];

      // Check if required field is missing
      if (!rule.optional && (value === undefined || value === null || value === '')) {
        if (rule.required !== false) {
          errors.push({
            field: rule.field,
            message: `${rule.field} is required`
          });
          continue;
        }
      }

      // Skip validation if optional and empty
      if (rule.optional && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Type-specific validation
      let isValid = true;
      let errorMessage = `${rule.field} is invalid`;

      switch (rule.type) {
        case 'email':
          isValid = SecureValidation.validateEmail(value);
          errorMessage = 'Please provide a valid email address';
          break;

        case 'uuid':
          isValid = SecureValidation.validateUUID(value);
          errorMessage = 'ID must be a valid UUID';
          break;

        case 'password':
          isValid = SecureValidation.validatePassword(value);
          errorMessage = 'Password must be between 8 and 128 characters and contain at least one lowercase letter, one uppercase letter, and one number';
          break;

        case 'name':
          const trimmedName = typeof value === 'string' ? value.trim() : value;
          isValid = SecureValidation.validateName(trimmedName);
          errorMessage = 'Name must be between 1 and 100 characters and can only contain letters, numbers, spaces, hyphens, underscores, apostrophes, and periods';
          break;

        case 'projectName':
          const trimmedProjectName = typeof value === 'string' ? value.trim() : value;
          isValid = SecureValidation.validateProjectName(trimmedProjectName);
          errorMessage = 'Project name must be between 1 and 200 characters and can only contain letters, numbers, spaces, and common punctuation';
          break;

        case 'description':
          const trimmedDescription = typeof value === 'string' ? value.trim() : value;
          isValid = SecureValidation.validateDescription(trimmedDescription);
          errorMessage = 'Description must be less than 2000 characters';
          break;

        case 'taskTitle':
          const trimmedTitle = typeof value === 'string' ? value.trim() : value;
          isValid = trimmedTitle.length >= 1 && trimmedTitle.length <= 500;
          errorMessage = 'Task title must be between 1 and 500 characters';
          break;

        case 'statusLabel':
          const trimmedLabel = typeof value === 'string' ? value.trim() : value;
          isValid = SecureValidation.validateStatusLabel(trimmedLabel);
          errorMessage = 'Status label must be between 1 and 50 characters and can only contain letters, numbers, spaces, hyphens, underscores, apostrophes, and periods';
          break;

        case 'color':
          isValid = SecureValidation.validateColor(value);
          errorMessage = 'Color must be a valid hex color (e.g., #FF0000 or #F00)';
          break;

        case 'order':
          const numValue = Number(value);
          isValid = SecureValidation.validateOrder(numValue);
          errorMessage = 'Order must be a number between 0 and 1000';
          break;

        case 'role':
          isValid = SecureValidation.validateRole(value);
          errorMessage = 'Role must be user, admin, or superuser';
          break;

        case 'boolean':
          isValid = typeof value === 'boolean';
          errorMessage = `${rule.field} must be a boolean`;
          break;

        case 'number':
          isValid = !isNaN(Number(value));
          errorMessage = `${rule.field} must be a number`;
          break;

        case 'string':
        default:
          isValid = typeof value === 'string';
          if (isValid && rule.minLength) {
            isValid = value.length >= rule.minLength;
            errorMessage = `${rule.field} must be at least ${rule.minLength} characters`;
          }
          if (isValid && rule.maxLength) {
            isValid = value.length <= rule.maxLength;
            errorMessage = `${rule.field} must be at most ${rule.maxLength} characters`;
          }
          break;
      }

      if (!isValid) {
        errors.push({
          field: rule.field,
          message: errorMessage
        });
      }
    }

    if (errors.length > 0) {
      logger.warn('Input validation failed', {
        component: 'secureValidation',
        method: req.method,
        url: req.url,
        errors: errors,
        correlationId: (req as any).correlationId
      });

      return res.status(400).json({
        error: 'Invalid input data',
        details: errors.map(error => ({
          field: error.field,
          message: error.message,
          value: undefined // Don't echo back potentially malicious input
        }))
      });
    }

    next();
  };
}

// Convenience functions for common validations (backward compatibility)
export const commonValidations = {
  // ID validation (UUID format)
  id: () => createSecureValidation([
    { field: 'id', source: 'params', type: 'uuid' }
  ]),

  // Email validation
  email: () => createSecureValidation([
    { field: 'email', source: 'body', type: 'email' }
  ]),

  // Password validation
  password: () => createSecureValidation([
    { field: 'password', source: 'body', type: 'password' }
  ]),

  // Current password (for change password)
  currentPassword: () => createSecureValidation([
    { field: 'currentPassword', source: 'body', type: 'string', minLength: 1 }
  ]),

  // New password (for change password)
  newPassword: () => createSecureValidation([
    { field: 'newPassword', source: 'body', type: 'password' }
  ]),

  // Name validation
  name: () => createSecureValidation([
    { field: 'name', source: 'body', type: 'name' }
  ]),

  // Project name validation
  projectName: () => createSecureValidation([
    { field: 'name', source: 'body', type: 'projectName' }
  ]),

  // Description validation (optional)
  description: () => createSecureValidation([
    { field: 'description', source: 'body', type: 'description', optional: true }
  ]),

  // Task title validation
  taskTitle: () => createSecureValidation([
    { field: 'title', source: 'body', type: 'taskTitle' }
  ]),

  // Status label validation
  statusLabel: () => createSecureValidation([
    { field: 'label', source: 'body', type: 'statusLabel' }
  ]),

  // Optional status label validation (for updates)
  statusLabelOptional: () => createSecureValidation([
    { field: 'label', source: 'body', type: 'statusLabel', optional: true }
  ]),

  // Color validation (hex color)
  color: () => createSecureValidation([
    { field: 'color', source: 'body', type: 'color', optional: true }
  ]),

  // Order validation
  order: () => createSecureValidation([
    { field: 'order', source: 'body', type: 'order', optional: true }
  ]),

  // Boolean validations
  showStrikeThrough: () => createSecureValidation([
    { field: 'showStrikeThrough', source: 'body', type: 'boolean', optional: true }
  ]),

  hidden: () => createSecureValidation([
    { field: 'hidden', source: 'body', type: 'boolean', optional: true }
  ]),

  // Comment requirement validations
  requiresComment: () => createSecureValidation([
    { field: 'requiresComment', source: 'body', type: 'boolean', optional: true }
  ]),

  allowsComment: () => createSecureValidation([
    { field: 'allowsComment', source: 'body', type: 'boolean', optional: true }
  ]),

  // Role validation
  role: () => createSecureValidation([
    { field: 'role', source: 'body', type: 'role' }
  ])
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Remove HTML tags and scripts
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>?/gm, '')
        .trim();
    }
    if (typeof value === 'object' && value !== null) {
        // Preserve arrays as arrays (sanitize each element). Previously this
        // converted arrays into plain objects with numeric keys which broke
        // downstream Array.isArray checks (e.g. PATCH /statuses/order).
        if (Array.isArray(value)) {
          return value.map(v => sanitizeValue(v));
        }
        const sanitizedObj: any = {};
        for (const [key, val] of Object.entries(value)) {
          sanitizedObj[key] = sanitizeValue(val);
        }
        return sanitizedObj;
    }
    return value;
  };

  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  
  next();
};