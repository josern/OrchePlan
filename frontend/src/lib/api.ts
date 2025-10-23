"use client"

import { addCsrfHeaders } from './csrf';

// Smart API base URL detection
export const getApiBase = () => {
  // Always prioritize environment variable
  const envApiBase = process.env.NEXT_PUBLIC_API_BASE;
  
  if (envApiBase) {
    return envApiBase;
  }
  
  // Server-side rendering fallback
  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }
  
  // Client-side fallback - only basic localhost detection
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  // For any other domain, environment variable should be set
  // This prevents hardcoded production URLs
  console.warn('[API] No NEXT_PUBLIC_API_BASE environment variable set. Using localhost fallback.');
  return 'http://localhost:3001';
};

const API_BASE = getApiBase();

// We use cookie-based auth (HttpOnly cookie). Avoid relying on client-stored JWTs.
let authToken: string | null = null;

function setAuthToken(token: string | null) {
  // Keep function for legacy cleanup; do not persist tokens to localStorage by default.
  authToken = null;
  try {
    if (typeof window !== 'undefined' && token === null) {
      // remove any legacy token value
      window.localStorage.removeItem('orcheplan_token');
    }
  } catch (e) {
    // ignore storage errors in restricted environments
  }
}

type FetchOptions = Omit<RequestInit, 'body'> & { 
  body?: any;
  _csrfRetry?: boolean; // Internal flag to prevent infinite retry loops
}

// Create an error that won't log stack traces (expected user error)
function createExpectedError(message: string, status?: number, body?: any): Error {
  const error: any = new Error(message);
  error.status = status;
  error.body = body;
  error.isExpected = true;
  return error;
}

async function request(path: string, opts: FetchOptions = {}) {
  const headers: any = opts.headers ? {...opts.headers} : {}
  
  // Add CSRF token for state-changing requests
  if (opts.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(opts.method.toUpperCase())) {
    try {
      await addCsrfHeaders(headers);
    } catch (error) {
      // In production, this should fail the request
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }
  
  // We rely on cookie-based authentication (credentials: 'include').
  // Do not attach Authorization header from client-side JWTs.
  if (opts.body && typeof opts.body === 'object') {
    headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(opts.body)
  }

  const url = API_BASE + path;

  try {
    const res = await fetch(url, {
      credentials: 'include', // allow cookies
      ...opts,
      headers,
    })

    const text = await res.text()
    let data: any = undefined
    try { data = text ? JSON.parse(text) : undefined } catch(e) { data = text }

        // debug: log small request/response summaries to aid local troubleshooting
    try {
      const safeBody = (() => {
        try { return opts.body ? JSON.parse(opts.body as string) : null } catch { return opts.body }
      })()
      // Remove debug logging in production
    } catch (e) {}

    if (!res.ok) {
      const msg = data?.message || data?.error || res.statusText || 'Request failed'
      
      // Check if this is an expected error that shouldn't create a logged Error
      const isAuthEndpoint = url.includes('/auth/');
      const is400 = res.status === 400;
      const is401 = res.status === 401;
      const is404 = res.status === 404;
      const is409 = res.status === 409;
      const isExpectedAuth = isAuthEndpoint && (is400 || is401 || is404 || is409);
      
      // Create error object
      let err: any;
      
      if (isExpectedAuth) {
        // For expected auth errors, create a plain object that won't be logged by the browser
        err = {
          message: msg,
          status: res.status,
          body: data,
          isExpected: true,
          name: 'ExpectedAPIError'
        };
      } else {
        // For unexpected errors, create a proper Error object for debugging
        err = new Error(msg);
        err.status = res.status;
        err.body = data;
      }
      
      throw err
    }

    return data
  } catch (error: any) {
    // Check if this is a CSRF error (403 status often indicates CSRF failure)
    if (error?.status === 403 && error?.body?.code === 'EBADCSRFTOKEN') {
      // Clear cached CSRF token and retry once
      const { clearCsrfToken } = await import('./csrf');
      clearCsrfToken();
      
      // Only retry once to avoid infinite loops
      if (!opts._csrfRetry) {
        return request(path, { ...opts, _csrfRetry: true });
      }
    }
    
    // Check if this is an expected error that shouldn't be logged
    const isAuthEndpoint = url.includes('/auth/');
    const is400 = error?.status === 400;
    const is401 = error?.status === 401;
    const is404 = error?.status === 404;
    const is409 = error?.status === 409;
    const isExpectedAuth = isAuthEndpoint && (is400 || is401 || is404 || is409);
    const isStaleAuth = !isAuthEndpoint && (is401 || is404);
    
    // Mark expected errors
    if (isExpectedAuth || isStaleAuth) {
      error.isExpected = true;
    }
    
    // Only log unexpected errors
    if (!isExpectedAuth && !isStaleAuth) {
      console.error('[api] Request failed:', {
        url,
        method: opts.method || 'GET',
        error: error instanceof Error ? error.message : String(error),
        status: error?.status,
        statusText: error?.statusText,
        body: error?.body,
        stack: error instanceof Error ? error.stack : undefined,
        fullError: error,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        isNetworkError: !error?.status,
        timestamp: new Date().toISOString(),
        // Additional debugging info
        errorKeys: error ? Object.keys(error) : [],
        errorJson: error ? JSON.stringify(error, null, 2) : 'null',
        hasErrorMessage: !!error?.message,
        hasErrorStatus: !!error?.status,
        hasErrorBody: !!error?.body,
        isAuthEndpoint,
        expectedAuthFlags: { isExpectedAuth, isStaleAuth, is400, is401, is404, is409 }
      });
    } else if (isStaleAuth) {
      // Log stale auth as warning only
      console.warn('[api] Authentication may be stale:', {
        url,
        status: error.status,
        message: 'Consider clearing browser data if this persists'
      });
    }
    // For isExpectedAuth, we don't log anything (silent)
    
    throw error;
  }
}

export async function authLogin(email: string, password: string) {
  // For cookie-based auth we don't need to persist the JWT client-side.
  // The server sets an HttpOnly cookie with the token.
  try {
    const resp: any = await request('/auth/login', { method: 'POST', body: { email, password } })
    return resp
  } catch (error: any) {
    // For expected auth errors, don't re-throw to avoid console logging
    if (error.status === 400 || error.status === 401) {
      // Return the error as a structured response instead of throwing
      return {
        success: false,
        error: error.body?.error || error.message || 'Login failed',
        status: error.status,
        isExpected: true
      };
    }
    // For unexpected errors, still throw
    throw error;
  }
}

export async function authSignup(name: string, email: string, password: string) {
  try {
    const resp = await request('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    })
    return resp
  } catch (error: any) {
    // For expected auth errors, don't re-throw to avoid console logging
    if (error.status === 400 || error.status === 409) {
      // Return the error as a structured response instead of throwing
      return {
        success: false,
        error: error.body?.error || error.message || 'Signup failed',
        status: error.status,
        isExpected: true
      };
    }
    // For unexpected errors, still throw
    throw error;
  }
}

export async function authLogout() {
  try {
    const resp = await request('/auth/logout', { method: 'POST' })
    return resp
  } finally {
    // clear token client-side regardless of server response
    setAuthToken(null)
  }
}

export async function authMe() {
  try {
    return await request('/auth/me', { method: 'GET' });
  } catch (error: any) {
    // If unauthorized (401) or user not found (404), return null instead of throwing
    // This is expected when no user is logged in or session is invalid
    if (error.status === 401 || error.status === 404) {
      return null;
    }
    // For other errors, mark as unexpected and re-throw
    error.isExpected = false;
    throw error;
  }
}

export async function authChangePassword(currentPassword: string, newPassword: string) {
  return request('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } })
}

// Server-side external proxy helper
// Usage: externalProxy('coder.josern.com', '/api/v2/applications/auth-redirect')
export async function externalProxy(host: string, target: string, opts: FetchOptions = {}) {
  const params = new URLSearchParams();
  params.set('host', host);
  params.set('target', target);
  const path = `/external-proxy?${params.toString()}`;
  return request(path, { method: opts.method || 'GET', body: opts.body, headers: opts.headers });
}

// Projects
export async function getProjects() {
  return request('/projects', { method: 'GET' })
}

export async function getProject(projectId: string) {
  return request(`/projects/${projectId}`, { method: 'GET' })
}

export async function createProject(body: any) {
  return request('/projects', { method: 'POST', body })
}

export async function updateProjectApi(projectId: string, body: any) {
  return request(`/projects/${projectId}`, { method: 'PUT', body })
}

export async function deleteProjectApi(projectId: string) {
  return request(`/projects/${projectId}`, { method: 'DELETE' })
}

// Project Members
export async function addProjectMember(projectId: string, userId: string, role: string) {
  return request(`/projects/${projectId}/members`, { method: 'POST', body: { userId, role } })
}

export async function updateProjectMemberRole(projectId: string, userId: string, role: string) {
  return request(`/projects/${projectId}/members/${userId}`, { method: 'PUT', body: { role } })
}

export async function removeProjectMember(projectId: string, userId: string) {
  return request(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' })
}

// Users
export async function getUsers() {
  return request('/users', { method: 'GET' })
}

export async function updateUserApi(userId: string, body: { name?: string; email?: string }) {
  return request(`/users/${userId}`, { method: 'PUT', body });
}

// Tasks
export async function getTasksByProjectIds(projectIds: string[]) {
  const params = new URLSearchParams();
  projectIds.forEach(id => params.append('projectId', id));
  return request(`/tasks?${params.toString()}`, { method: 'GET' })
}

export async function createTaskApi(body: any) {
  return request('/tasks', { method: 'POST', body })
}

export async function updateTaskApi(taskId: string, body: any) {
  return request(`/tasks/${taskId}`, { method: 'PUT', body })
}

export async function deleteTaskApi(taskId: string) {
  return request(`/tasks/${taskId}`, { method: 'DELETE' })
}

// Task Comments
export async function getTaskComments(taskId: string) {
  return request(`/tasks/${taskId}/comments`, { method: 'GET' });
}

export async function createTaskComment(taskId: string, content: string) {
  return request(`/tasks/${taskId}/comments`, { method: 'POST', body: { content } });
}

export async function updateTaskComment(taskId: string, commentId: string, content: string) {
  return request(`/tasks/${taskId}/comments/${commentId}`, { method: 'PUT', body: { content } });
}

export async function deleteTaskComment(taskId: string, commentId: string) {
  return request(`/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' });
}

// Statuses (task_statuses)
export async function getProjectStatuses(projectId: string) {
  return request(`/projects/${projectId}/statuses`, { method: 'GET' });
}

export async function createProjectStatus(projectId: string, body: { label: string; order?: number; color?: string | null; showStrikeThrough?: boolean; hidden?: boolean; requiresComment?: boolean; allowsComment?: boolean }) {
  return request(`/projects/${projectId}/statuses`, { method: 'POST', body });
}

export async function updateProjectStatus(projectId: string, statusId: string, body: { label?: string; order?: number; color?: string | null; showStrikeThrough?: boolean; hidden?: boolean; requiresComment?: boolean; allowsComment?: boolean }) {
  return request(`/projects/${projectId}/statuses/${statusId}`, { method: 'PUT', body });
}

export async function deleteProjectStatus(projectId: string, statusId: string) {
  return request(`/projects/${projectId}/statuses/${statusId}`, { method: 'DELETE' });
}

export async function updateProjectStatusesOrder(projectId: string, statuses: { id: string; order: number }[]) {
  return request(`/projects/${projectId}/statuses/order`, { method: 'PATCH', body: { statuses } });
}

// Generic API utility for admin and other custom endpoints
export const api = {
  get: (path: string, opts: Omit<FetchOptions, 'method'> = {}) => 
    request(path, { ...opts, method: 'GET' }),
  post: (path: string, body?: any, opts: Omit<FetchOptions, 'method' | 'body'> = {}) => 
    request(path, { ...opts, method: 'POST', body }),
  put: (path: string, body?: any, opts: Omit<FetchOptions, 'method' | 'body'> = {}) => 
    request(path, { ...opts, method: 'PUT', body }),
  delete: (path: string, opts: Omit<FetchOptions, 'method'> = {}) => 
    request(path, { ...opts, method: 'DELETE' }),
  patch: (path: string, body?: any, opts: Omit<FetchOptions, 'method' | 'body'> = {}) => 
    request(path, { ...opts, method: 'PATCH', body })
};

// Task move with comment requirements
export async function moveTaskToStatus(taskId: string, statusId: string, comment?: string) {
  return request(`/tasks/${taskId}/move`, { method: 'POST', body: { statusId, comment } });
}

export default { authLogin, authSignup, authLogout, authMe, authChangePassword, getProjects, getProject, createProject, updateProjectApi, deleteProjectApi, addProjectMember, updateProjectMemberRole, removeProjectMember, getUsers, updateUserApi, getTasksByProjectIds, createTaskApi, updateTaskApi, deleteTaskApi, getTaskComments, createTaskComment, updateTaskComment, deleteTaskComment, getProjectStatuses, createProjectStatus, updateProjectStatus, deleteProjectStatus, updateProjectStatusesOrder }

// earlier default removed; consolidated at end
