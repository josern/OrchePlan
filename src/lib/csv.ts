
import Papa from 'papaparse';
import type { Task, TaskStatusOption } from './types';
import { format, parse, isValid } from 'date-fns';

const DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss';

/**
 * Converts an array of tasks into a CSV string and triggers a download.
 * @param tasks - The array of tasks to export.
 * @param projectName - The name of the project, used for the filename.
 */
export function exportTasksToCSV(tasks: Task[], projectName: string) {
  if (tasks.length === 0) {
    console.warn('No tasks to export.');
    return;
  }

  const data = tasks.map(task => ({
    title: task.title,
    description: task.description || '',
    dueTime: task.dueTime || '',
    status: task.status,
    assigneeId: task.assigneeId || '',
    projectId: task.projectId,
  }));

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-s-8;' });
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
 * Parses a CSV file into an array of task objects.
 * @param file - The CSV file to import.
 * @param defaultProjectId - The project ID to assign to imported tasks.
 * @param taskStatusOptions - The available status options to map names to IDs.
 * @returns A promise that resolves to an array of new task objects.
 */
export function importTasksFromCSV(
    file: File, 
    defaultProjectId: string, 
    taskStatusOptions: TaskStatusOption[]
): Promise<Omit<Task, 'id'>[]> {
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

          const statusNameToId = new Map(taskStatusOptions.map(s => [s.name.toLowerCase(), s.id]));
          const defaultStatusId = taskStatusOptions.find(s => s.name.toLowerCase() === 'to do')?.id || taskStatusOptions[0]?.id;

          if (!defaultStatusId) {
            reject(new Error("Could not find a default 'To Do' status. Please ensure it exists."));
            return;
          }

          const newTasks: Omit<Task, 'id'>[] = results.data.map((row: any, index) => {
            const { title, description, dueTime, status, assigneeId } = row;

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

            const statusId = statusNameToId.get(status?.toLowerCase()) || defaultStatusId;

            const task: Omit<Task, 'id'> = {
              title,
              description: description || '',
              dueTime: parsedDate ? format(parsedDate, DATE_FORMAT) : undefined,
              status: statusId,
              assigneeId: assigneeId || undefined,
              projectId: defaultProjectId, // Always use the default project ID
            };
            return task;
          });

          resolve(newTasks);
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
