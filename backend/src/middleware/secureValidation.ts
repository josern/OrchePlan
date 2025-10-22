import { Request, Response, NextFunction } from 'express';
import { isSecureEmail, isSecureURL } from '../utils/secureValidation';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('SecureValidationMiddleware');

/**
 * Secure validation middleware that replaces express-validator
 * to eliminate dependency on vulnerable validator.js package
 */

interface ValidationRule {
  field: string;
  required?: boolean;
  type: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'uuid' | 'password';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export class SecureValidator {
  private rules: ValidationRule[] = [];

  static body(field: string) {
    return new SecureValidator().addRule({ field, required: true, type: 'string' });
  }

  static param(field: string) {
    return new SecureValidator().addRule({ field, required: true, type: 'string' });
  }

  static query(field: string) {
    return new SecureValidator().addRule({ field, required: false, type: 'string' });
  }

  private addRule(rule: ValidationRule) {
    this.rules.push(rule);
    return this;
  }

  isEmail() {
    const lastRule = this.rules[this.rules.length - 1];
    lastRule.type = 'email';
    return this;
  }

  isURL(options?: { allowedProtocols?: string[] }) {
    const lastRule = this.rules[this.rules.length - 1];
    lastRule.type = 'url';
    lastRule.custom = (value) => isSecureURL(value, options);
    return this;
  }

  isUUID() {
    const lastRule = this.rules[this.rules.length - 1];
    lastRule.type = 'uuid';
    lastRule.pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return this;
  }

  isLength(options: { min?: number; max?: number }) {
    const lastRule = this.rules[this.rules.length - 1];
    if (options.min !== undefined) lastRule.minLength = options.min;
    if (options.max !== undefined) lastRule.maxLength = options.max;
    return this;
  }

  isInt(options?: { min?: number; max?: number }) {
    const lastRule = this.rules[this.rules.length - 1];
    lastRule.type = 'number';
    if (options?.min !== undefined) lastRule.min = options.min;
    if (options?.max !== undefined) lastRule.max = options.max;
    return this;
  }

  isBoolean() {
    const lastRule = this.rules[this.rules.length - 1];
    lastRule.type = 'boolean';
    return this;
  }

  matches(pattern: RegExp) {
    const lastRule = this.rules[this.rules.length - 1];
    lastRule.pattern = pattern;
    return this;
  }

  optional() {
    const lastRule = this.rules[this.rules.length - 1];
    lastRule.required = false;
    return this;
  }

  custom(validator: (value: any) => boolean | string) {
    const lastRule = this.rules[this.rules.length - 1];
    lastRule.custom = validator;
    return this;
  }

  withMessage(message: string) {
    // Store message for the last rule (implementation would need to be enhanced)
    return this;
  }

  normalizeEmail() {
    // For compatibility - would implement email normalization
    return this;
  }

  trim() {
    // For compatibility - would implement string trimming
    return this;
  }

  validate(data: any): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const rule of this.rules) {
      const value = data[rule.field];
      
      // Check if required field is missing
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: rule.field,
          message: `${rule.field} is required`
        });
        continue;
      }

      // Skip validation if optional and empty
      if (!rule.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Type validation
      switch (rule.type) {
        case 'email':
          if (!isSecureEmail(value)) {
            errors.push({
              field: rule.field,
              message: 'Please provide a valid email address'
            });
          }
          break;

        case 'url':
          if (rule.custom && !rule.custom(value)) {
            errors.push({
              field: rule.field,
              message: 'Please provide a valid URL'
            });
          }
          break;

        case 'number':
          const num = Number(value);
          if (isNaN(num)) {
            errors.push({
              field: rule.field,
              message: `${rule.field} must be a number`
            });
          } else {
            if (rule.min !== undefined && num < rule.min) {
              errors.push({
                field: rule.field,
                message: `${rule.field} must be at least ${rule.min}`
              });
            }
            if (rule.max !== undefined && num > rule.max) {
              errors.push({
                field: rule.field,
                message: `${rule.field} must be at most ${rule.max}`
              });
            }
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push({
              field: rule.field,
              message: `${rule.field} must be a boolean`
            });
          }
          break;

        case 'string':
        default:
          if (typeof value !== 'string') {
            errors.push({
              field: rule.field,
              message: `${rule.field} must be a string`
            });
            break;
          }

          // Length validation
          if (rule.minLength !== undefined && value.length < rule.minLength) {
            errors.push({
              field: rule.field,
              message: `${rule.field} must be at least ${rule.minLength} characters`
            });
          }
          if (rule.maxLength !== undefined && value.length > rule.maxLength) {
            errors.push({
              field: rule.field,
              message: `${rule.field} must be at most ${rule.maxLength} characters`
            });
          }

          // Pattern validation
          if (rule.pattern && !rule.pattern.test(value)) {
            errors.push({
              field: rule.field,
              message: `${rule.field} format is invalid`
            });
          }
          break;
      }

      // Custom validation
      if (rule.custom && rule.type !== 'url') {
        const result = rule.custom(value);
        if (result !== true) {
          errors.push({
            field: rule.field,
            message: typeof result === 'string' ? result : `${rule.field} is invalid`
          });
        }
      }
    }

    return errors;
  }
}

/**
 * Create validation middleware from rules
 */
export function createValidationMiddleware(validators: SecureValidator[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const allErrors: ValidationError[] = [];

    for (const validator of validators) {
      const errors = validator.validate({ ...req.body, ...req.params, ...req.query });
      allErrors.push(...errors);
    }

    if (allErrors.length > 0) {
      logger.warn('Secure validation failed', {
        component: 'secureValidation',
        method: req.method,
        url: req.url,
        errors: allErrors,
        correlationId: (req as any).correlationId
      });

      return res.status(400).json({
        error: 'Invalid input data',
        details: allErrors.map(error => ({
          field: error.field,
          message: error.message,
          value: undefined // Don't echo back potentially malicious input
        }))
      });
    }

    next();
  };
}

// Backward compatibility with express-validator style
export const body = SecureValidator.body;
export const param = SecureValidator.param;
export const query = SecureValidator.query;