import { commonValidations, createSecureValidation } from './validation';

// Auth endpoint validations (secure - no express-validator dependency)
export const validateSignup = [
  commonValidations.email(),
  commonValidations.password(),
  commonValidations.name()
];

export const validateLogin = [
  commonValidations.email(),
  commonValidations.password()
];

export const validateChangePassword = [
  commonValidations.currentPassword(),
  createSecureValidation([
    { field: 'newPassword', source: 'body', type: 'password' }
  ])
];

// Project validations (secure)
export const validateCreateProject = [
  commonValidations.projectName(),
  commonValidations.description()
];

export const validateUpdateProject = [
  commonValidations.id(),
  createSecureValidation([
    { field: 'name', source: 'body', type: 'projectName', optional: true }
  ]),
  commonValidations.description()
];

// Task validations (secure)
export const validateCreateTask = [
  commonValidations.taskTitle(),
  commonValidations.description(),
  createSecureValidation([
    { field: 'projectId', source: 'body', type: 'uuid' },
    { field: 'statusId', source: 'body', type: 'uuid', optional: true },
    { field: 'assigneeId', source: 'body', type: 'uuid', optional: true }
  ])
];

export const validateUpdateTask = [
  commonValidations.id(),
  createSecureValidation([
    { field: 'title', source: 'body', type: 'taskTitle', optional: true }
  ]),
  commonValidations.description(),
  createSecureValidation([
    { field: 'statusId', source: 'body', type: 'uuid', optional: true },
    { field: 'assigneeId', source: 'body', type: 'uuid', optional: true }
  ])
];

export const validateUpdateTaskStatus = [
  commonValidations.id(),
  createSecureValidation([
    { field: 'statusId', source: 'body', type: 'uuid' },
    { field: 'comment', source: 'body', type: 'string', optional: true, maxLength: 2000 }
  ])
];

// Status validations (secure)
export const validateCreateStatus = [
  commonValidations.statusLabel(),
  commonValidations.color(),
  commonValidations.order(),
  commonValidations.showStrikeThrough(),
  commonValidations.hidden(),
  commonValidations.requiresComment(),
  commonValidations.allowsComment()
];

export const validateUpdateStatus = [
  commonValidations.id(),
  commonValidations.statusLabelOptional(),
  commonValidations.color(),
  commonValidations.order(),
  commonValidations.showStrikeThrough(),
  commonValidations.hidden(),
  commonValidations.requiresComment(),
  commonValidations.allowsComment()
];

export const validateDeleteStatus = [
  commonValidations.id()
];

export const validateGetStatus = [
  commonValidations.id()
];

export const validateBulkUpdateStatuses = [
  createSecureValidation([
    { field: 'statusIds', source: 'body', type: 'string' }
  ])
];

// User management validations (secure)
export const validateGetUsers = [
  createSecureValidation([
    { field: 'page', source: 'query', type: 'number', optional: true },
    { field: 'limit', source: 'query', type: 'number', optional: true },
    { field: 'search', source: 'query', type: 'string', optional: true, maxLength: 100 }
  ])
];

export const validateUpdateUserRole = [
  commonValidations.id(),
  commonValidations.role()
];

// Admin validations (secure)
export const validateBlockIP = [
  createSecureValidation([
    { field: 'ip', source: 'body', type: 'string' },
    { field: 'reason', source: 'body', type: 'string', minLength: 1, maxLength: 500 }
  ])
];

export const validateSearchUsers = [
  createSecureValidation([
    { field: 'search', source: 'query', type: 'string', optional: true, maxLength: 100 }
  ])
];

// Additional project validations for compatibility
export const validateDeleteProject = [
  commonValidations.id()
];

export const validateGetProject = [
  commonValidations.id()
];

// Pagination validation
export const validatePagination = [
  createSecureValidation([
    { field: 'page', source: 'query', type: 'number', optional: true },
    { field: 'limit', source: 'query', type: 'number', optional: true }
  ])
];

// Additional task validations
export const validateDeleteTask = [
  commonValidations.id()
];

export const validateMoveTask = [
  commonValidations.id(),
  createSecureValidation([
    { field: 'statusId', source: 'body', type: 'uuid' },
    { field: 'comment', source: 'body', type: 'string', optional: true }
  ])
];

// Additional status validations  
export const validateUpdateStatusParam = [
  commonValidations.id()
];

export const validateDeleteStatusParam = [
  commonValidations.id()
];

export const validateUpdateStatusOrder = [
  createSecureValidation([
    { field: 'statusIds', source: 'body', type: 'string' }
  ])
];

// Member/User validations
export const validateAddProjectMember = [
  commonValidations.id(),
  createSecureValidation([
    { field: 'userId', source: 'body', type: 'uuid' }
  ])
];

export const validateUpdateProjectMemberRoleParam = [
  commonValidations.id(),
  createSecureValidation([
    { field: 'userId', source: 'params', type: 'uuid' }
  ])
];

export const validateRemoveProjectMemberParam = [
  commonValidations.id(),
  createSecureValidation([
    { field: 'userId', source: 'params', type: 'uuid' }
  ])
];

export const validateUpdateUser = [
  commonValidations.id(),
  createSecureValidation([
    { field: 'name', source: 'body', type: 'name', optional: true },
    { field: 'email', source: 'body', type: 'email', optional: true }
  ])
];

export const validateGetUser = [
  commonValidations.id()
];
