import type { TaskStatusOption } from './types';

export interface CommentRequirement {
  shouldShowModal: boolean;
  isRequired: boolean;
  statusName?: string;
}

/**
 * Determines comment requirements for a status change
 */
export function getCommentRequirement(
  newStatusId: string,
  taskStatusOptions: TaskStatusOption[]
): CommentRequirement {
  const targetStatus = taskStatusOptions.find(s => s.id === newStatusId);
  
  if (!targetStatus) {
    return { shouldShowModal: false, isRequired: false };
  }
  
  // Check comment requirements: Required OR Optional (but not Disabled)
  const shouldShowModal = targetStatus.requiresComment || 
                         (targetStatus.allowsComment && !targetStatus.requiresComment);
  
  return {
    shouldShowModal: shouldShowModal || false,
    isRequired: targetStatus.requiresComment || false,
    statusName: targetStatus.name
  };
}

/**
 * Handles task status change with comment requirements
 */
export async function handleTaskStatusChangeWithComment(
  taskId: string,
  newStatusId: string,
  taskStatusOptions: TaskStatusOption[],
  onShowCommentModal: (requirement: CommentRequirement) => void,
  onDirectUpdate: (taskId: string, statusId: string) => void
) {
  const requirement = getCommentRequirement(newStatusId, taskStatusOptions);
  
  if (requirement.shouldShowModal) {
    onShowCommentModal(requirement);
  } else {
    // No comment required, proceed with direct update
    onDirectUpdate(taskId, newStatusId);
  }
}