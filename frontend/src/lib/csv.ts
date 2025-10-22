
import Papa from 'papaparse';
import type { Task, TaskStatusOption } from './types';
import { format, parse, isValid } from 'date-fns';

const DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss';

/**
 * Helper function to get the title of a parent task by ID
 */
function getParentTaskTitle(parentId: string, tasks: Task[]): string {
  const parentTask = tasks.find(t => t.id === parentId);
  return parentTask ? parentTask.title : '';
}

/**
 * Converts an array of tasks into a CSV string and triggers a download.
 * @param tasks - The array of tasks to export.
 * @param projectName - The name of the project, used for the filename.
 * @param taskStatusOptions - The status options to map IDs to names for export.
 */
export function exportTasksToCSV(tasks: Task[], projectName: string, taskStatusOptions: TaskStatusOption[] = []) {
  if (tasks.length === 0) {
    console.warn('No tasks to export.');
    return;
  }

  // Create a map of status ID to status name for better import compatibility
  const statusIdToName = new Map(taskStatusOptions.map(s => [s.id, s.name]));
  

  const data = tasks.map(task => {
    // Handle both 'status' and 'statusId' fields for compatibility
    const taskStatusId = task.status || (task as any).statusId;
    const statusName = statusIdToName.get(taskStatusId) || taskStatusId;
    
    return {
      title: task.title,
      description: task.description || '',
      dueTime: task.dueTime || '',
      status: statusName, // Export status name instead of ID
      assigneeId: task.assigneeId || '',
      // Note: Don't export projectId or parentId as these will be new when imported
      parentTitle: task.parentId ? getParentTaskTitle(task.parentId, tasks) : '', // Reference parent by title only
      isSubtask: !!task.parentId, // Flag to indicate if this is a subtask
    };
  });

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  const safeProjectName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  link.setAttribute('download', `${safeProjectName}_tasks_export.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Maps a status name from CSV to a status ID in the target project.
 * Uses multiple fallback strategies to find the best match.
 */
function mapStatusToId(statusName: string, taskStatusOptions: TaskStatusOption[]): string {
  if (!statusName || !taskStatusOptions.length) {
    return taskStatusOptions[0]?.id || '';
  }

  const normalizedInput = statusName.toLowerCase().trim();
  
  // Strategy 1: Exact name match (case-insensitive)
  let match = taskStatusOptions.find(s => s.name.toLowerCase() === normalizedInput);
  if (match) {
    return match.id;
  }
  
  // Strategy 2: Partial match (contains)
  match = taskStatusOptions.find(s => s.name.toLowerCase().includes(normalizedInput));
  if (match) {
    return match.id;
  }
  
  // Strategy 3: Common status name mappings
  const commonMappings = new Map([
    // Variations of "To Do"
    ['todo', ['to do', 'todo', 'to-do', 'pending', 'backlog', 'new']],
    ['in-progress', ['in progress', 'in-progress', 'doing', 'active', 'working', 'started']],
    ['done', ['done', 'completed', 'finished', 'complete', 'closed', 'resolved']],
    ['blocked', ['blocked', 'blocked', 'on hold', 'waiting', 'paused', 'stuck']],
    ['review', ['review', 'in review', 'testing', 'qa', 'ready for review']],
  ]);
  
  for (const [category, variations] of commonMappings.entries()) {
    if (variations.some(variation => normalizedInput.includes(variation))) {
      // Find a status in the target project that matches this category
      match = taskStatusOptions.find(s => {
        const targetName = s.name.toLowerCase();
        return variations.some(variation => targetName.includes(variation));
      });
      if (match) return match.id;
    }
  }
  
  // Strategy 4: Default to first status (usually "To Do")
  const defaultStatus = taskStatusOptions.find(s => 
    s.name.toLowerCase().includes('to do') || 
    s.name.toLowerCase().includes('todo') ||
    s.name.toLowerCase().includes('pending')
  ) || taskStatusOptions[0];
  
  return defaultStatus?.id || '';
}

/**
 * Parses a CSV file into an array of task objects with proper parent-child relationship handling.
 * @param file - The CSV file to import.
 * @param defaultProjectId - The project ID to assign to imported tasks.
 * @param taskStatusOptions - The available status options to map names to IDs.
 * @param existingTasks - Existing tasks in the project (to resolve parent task references by title).
 * @returns A promise that resolves to task creation instructions.
 */
export function importTasksFromCSV(
    file: File, 
    defaultProjectId: string, 
    taskStatusOptions: TaskStatusOption[],
    existingTasks: Task[] = []
): Promise<{ 
  mainTasks: Omit<Task, 'id'>[]; 
  subtaskGroups: { parentTitle: string; subtasks: Omit<Task, 'id'>[] }[];
  warnings: string[] 
}> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          if (results.errors.length) {
            console.error('CSV Parsing Errors:', results.errors);
            reject(new Error(`Error parsing CSV: ${results.errors.map(e => e.message).join(', ')}`));
            return;
          }

          if (!taskStatusOptions.length) {
            reject(new Error("No task status options available in the target project."));
            return;
          }

          const warnings: string[] = [];
          const mainTasks: Omit<Task, 'id'>[] = [];
          const subtaskGroups: { parentTitle: string; subtasks: Omit<Task, 'id'>[] }[] = [];
          
          // Create a map of existing task titles to IDs for parent lookup
          const existingTaskTitleToIdMap = new Map(
            existingTasks.map(t => [t.title.toLowerCase().trim(), t.id])
          );

          // Parse all rows first
          const parsedRows = results.data.map((row: any, index) => {
            const { title, description, dueTime, status, assigneeId, parentTitle, isSubtask } = row;

            if (!title) {
              throw new Error(`Row ${index + 2}: 'title' is a required field.`);
            }
            
            let parsedDate: Date | undefined = undefined;
            if (dueTime) {
                const date = parse(dueTime, DATE_FORMAT, new Date());
                if (!isValid(date)) {
                    throw new Error(`Row ${index + 2}: Invalid 'dueTime' format. Expected '${DATE_FORMAT}'.`);
                }
                parsedDate = date;
            }

            // Use improved status mapping
            const statusId = mapStatusToId(status, taskStatusOptions);

            const baseTask = {
              title: title.trim(),
              description: description?.trim() || '',
              priority: 'normal' as const, // Default priority
              dueTime: parsedDate ? format(parsedDate, DATE_FORMAT) : undefined,
              status: statusId,
              assigneeId: assigneeId?.trim() || undefined,
              projectId: defaultProjectId,
            };

            return {
              ...baseTask,
              rowIndex: index + 2,
              parentTitle: parentTitle?.trim() || '',
              isSubtask: isSubtask === 'true' || isSubtask === true || !!parentTitle
            };
          });

          // Separate main tasks and subtasks
          const mainTaskRows = parsedRows.filter(row => !row.isSubtask);
          const subtaskRows = parsedRows.filter(row => row.isSubtask);

          // Create main tasks (no parent dependencies)
          mainTaskRows.forEach(row => {
            const { rowIndex, parentTitle, isSubtask, ...task } = row;
            mainTasks.push(task);
          });

          // Group subtasks by parent title
          const subtasksByParent = new Map<string, typeof parsedRows>();
          subtaskRows.forEach(row => {
            const parentKey = row.parentTitle.toLowerCase();
            if (!subtasksByParent.has(parentKey)) {
              subtasksByParent.set(parentKey, []);
            }
            subtasksByParent.get(parentKey)!.push(row);
          });

          // Process subtask groups
          subtasksByParent.forEach((subtasks, parentTitleKey) => {
            const parentTitle = subtasks[0].parentTitle; // Get original case
            const subtaskList: Omit<Task, 'id'>[] = [];

            // Check if parent exists in existing tasks
            const existingParentId = existingTaskTitleToIdMap.get(parentTitleKey);
            
            // Check if parent is being imported as a main task
            const importedParent = mainTasks.find(t => t.title.toLowerCase() === parentTitleKey);

            if (!existingParentId && !importedParent) {
              // Parent doesn't exist - warn and convert subtasks to main tasks
              subtasks.forEach(row => {
                warnings.push(`Row ${row.rowIndex}: Parent task '${parentTitle}' not found. Converting subtask '${row.title}' to main task.`);
                const { rowIndex, parentTitle: _, isSubtask, ...task } = row;
                mainTasks.push(task);
              });
            } else {
              // Parent exists or will be created - create subtask group
              subtasks.forEach(row => {
                const { rowIndex, parentTitle: _, isSubtask, ...task } = row;
                // parentId will be set when the subtask is actually created
                subtaskList.push(task);
              });
              
              subtaskGroups.push({
                parentTitle,
                subtasks: subtaskList
              });
            }
          });

          resolve({ mainTasks, subtaskGroups, warnings });
        } catch (error) {
          reject(error);
        }
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
}