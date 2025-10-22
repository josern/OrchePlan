// Utility for handling bulk operations without triggering security alerts

interface BulkTaskData {
  title: string;
  description?: string;
  statusId?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  assignedTo?: string;
}

interface BulkImportResult {
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
export async function bulkImportTasks(
  projectId: string, 
  tasks: BulkTaskData[]
): Promise<BulkImportResult> {
  try {
    const response = await fetch('/api/tasks/bulk-import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        projectId,
        tasks
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

  // Process in smaller batches to avoid rate limiting
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    
    // Process batch in parallel but with overall throttling
    const batchPromises = batch.map(async (taskData, batchIndex) => {
      try {
        // Add small delay to avoid rapid-fire requests
        await new Promise(resolve => setTimeout(resolve, batchIndex * delay));
        
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...taskData,
            projectId
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
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