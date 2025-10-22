"use client"

// CSRF token management for frontend
let cachedToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

export async function getCsrfToken(): Promise<string> {
  // If we already have a cached token, return it
  if (cachedToken) {
    return cachedToken;
  }

  // If a request is already in progress, wait for it
  if (tokenPromise) {
    return tokenPromise;
  }

  // Start a new request for the token
  tokenPromise = fetchCsrfToken();
  
  try {
    cachedToken = await tokenPromise;
    return cachedToken;
  } finally {
    tokenPromise = null;
  }
}

async function fetchCsrfToken(): Promise<string> {
  // Import API_BASE dynamically to avoid circular dependencies
  const { getApiBase } = await import('./api');
  const API_BASE = getApiBase();
  
  
  const response = await fetch(`${API_BASE}/csrf-token`, {
    method: 'GET',
    credentials: 'include', // Include cookies
  });

  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token');
  }

  const data = await response.json();
  return data.csrfToken;
}

export function clearCsrfToken(): void {
  cachedToken = null;
  tokenPromise = null;
}

// Utility to add CSRF token to request headers
export async function addCsrfHeaders(headers: Record<string, string> = {}): Promise<Record<string, string>> {
  // Always add CSRF token for critical operations (backend requires it even in development)
  try {
    const token = await getCsrfToken();
    headers['X-CSRF-Token'] = token;
  } catch (error) {
    console.warn('Failed to get CSRF token:', error);
    // In production, this should fail the request
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
  
  return headers;
}