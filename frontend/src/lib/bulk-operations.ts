// Helper to read a cookie value by name
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : undefined;
}

// Fallback: fetch CSRF token from server endpoint when cookie is httpOnly
let _cachedCsrfToken: string | undefined;
async function fetchCsrfToken(): Promise<string | undefined> {
  if (_cachedCsrfToken) return _cachedCsrfToken;
  try {
    const resp = await fetch(`${API_BASE}/csrf-token`, { credentials: 'include' });
    if (!resp.ok) return undefined;
    const body = await resp.json();
    _cachedCsrfToken = body && body.csrfToken ? String(body.csrfToken) : undefined;
    return _cachedCsrfToken;
  } catch (err) {
    console.warn('Failed to fetch CSRF token', err);
    return undefined;
  }
}
// Utility for handling bulk operations without triggering security alerts

interface BulkTaskData {
  title: string;
  description?: string;
  statusId?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  dueDate?: string;
  assignedTo?: string;
}

export interface BulkImportResult {
  success: boolean;
  imported: number;
  failed: number;
  tasks: any[];
  errors: any[];
}

/**
 * Bulk import tasks using the dedicated bulk endpoint
 * Prevents rate limiting issues by using single API call
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://api.orcheplan.com';

export async function bulkImportTasks(
  projectId: string,
  tasks: BulkTaskData[]
): Promise<BulkImportResult> {
  try {
    // Validate input early to give a clear error instead of a server 400
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('No tasks to import — tasks array is empty');
    }
    // Map frontend fields to backend expected fields
    const mappedTasks = tasks.map(({ dueDate, assignedTo, ...rest }) => ({
      ...rest,
      dueTime: dueDate || null,
      assigneeId: assignedTo || null
    }));

    // try cookie first (may be httpOnly), otherwise fetch token endpoint
    let csrfToken = getCookie('_csrf');
    if (!csrfToken) csrfToken = await fetchCsrfToken();
  // (removed debug logs)

    const response = await fetch(`${API_BASE}/tasks/bulk-import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
      },
      credentials: 'include',
      body: JSON.stringify({
        projectId,
        tasks: mappedTasks,
        // also include token in body as a fallback in case a proxy/CDN strips headers
        ...(csrfToken ? { _csrf: csrfToken } : {})
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error('[bulkImport] server error', response.status, text);
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Bulk import failed:', error);
    throw error;
  }
}

/**
 * Legacy: Import tasks one by one with throttling
 * Use bulkImportTasks() instead for better performance
 */
export async function throttledTaskImport(
  projectId: string,
  tasks: BulkTaskData[],
  options: {
    delay?: number; // Delay between requests (ms)
    batchSize?: number; // Number of tasks per batch
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<{ successful: any[]; failed: any[] }> {
  
  const { delay = 100, batchSize = 5, onProgress } = options;
  const successful: any[] = [];
  const failed: any[] = [];

  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error('No tasks to import — tasks array is empty');
  }

  // Process in smaller batches to avoid rate limiting
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    
    // Process batch in parallel but with overall throttling
    const batchPromises = batch.map(async (taskData, batchIndex) => {
      try {
        // Add small delay to avoid rapid-fire requests
        await new Promise(resolve => setTimeout(resolve, batchIndex * delay));
        

        // try cookie first, otherwise fetch token endpoint
        let csrfToken = getCookie('_csrf');
        if (!csrfToken) csrfToken = await fetchCsrfToken();
  // (removed debug logs)
        const response = await fetch(`${API_BASE}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
          },
          credentials: 'include',
          body: JSON.stringify({
            ...taskData,
            projectId,
            ...(csrfToken ? { _csrf: csrfToken } : {})
          })
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          // eslint-disable-next-line no-console
          console.error('[throttledTaskImport] server error', response.status, text);
          throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const task = await response.json();
        successful.push(task);
        
      } catch (error) {
        failed.push({ 
          taskData, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    await Promise.all(batchPromises);
    
    // Report progress
    if (onProgress) {
      onProgress(successful.length + failed.length, tasks.length);
    }
    
    // Delay between batches
    if (i + batchSize < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, delay * batchSize));
    }
  }

  return { successful, failed };
}

/**
 * Parse CSV content into task data array
 */
export function parseTasksFromCSV(csvContent: string): BulkTaskData[] {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  const tasks: BulkTaskData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    
    if (values.length < headers.length || !values[0]) {
      continue; // Skip empty or incomplete rows
    }
    
    const task: BulkTaskData = {
      title: values[headers.indexOf('title')] || `Task ${i}`,
      description: values[headers.indexOf('description')] || '',
      priority: (values[headers.indexOf('priority')] as any) || 'medium',
      dueDate: values[headers.indexOf('duedate')] || values[headers.indexOf('due_date')] || undefined
    };
    
    tasks.push(task);
  }
  
  return tasks;
}