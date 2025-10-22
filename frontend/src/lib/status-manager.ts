import type { TaskStatusOption } from './types';

export class TaskStatusManager {
  private statusMap: Map<string, TaskStatusOption>;
  private statusOptions: TaskStatusOption[];

  constructor(statusOptions: TaskStatusOption[]) {
    this.statusOptions = statusOptions;
    this.statusMap = new Map(statusOptions.map(status => [status.id, status]));
  }

  getStatus(statusId: string): TaskStatusOption | undefined {
    return this.statusMap.get(statusId);
  }

  getStatusName(statusId: string): string {
    return this.statusMap.get(statusId)?.name || 'Unknown';
  }

  getStatusColor(statusId: string): string {
    return this.statusMap.get(statusId)?.color || '#E5E7EB';
  }

  requiresComment(statusId: string): boolean {
    return this.statusMap.get(statusId)?.requiresComment || false;
  }

  allowsComment(statusId: string): boolean {
    return this.statusMap.get(statusId)?.allowsComment ?? true;
  }

  shouldShowStrikeThrough(statusId: string): boolean {
    return this.statusMap.get(statusId)?.showStrikeThrough || false;
  }

  getAllStatuses(): TaskStatusOption[] {
    return this.statusOptions;
  }

  getDefaultStatus(): TaskStatusOption | undefined {
    return this.statusOptions.find(s => 
      s.name.toLowerCase().includes('to do') || 
      s.name.toLowerCase().includes('todo') ||
      s.name.toLowerCase().includes('pending')
    ) || this.statusOptions[0];
  }
}