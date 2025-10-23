'use client';

import React, { useMemo, useState, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { GripVertical, MoreHorizontal, Pencil, Trash2, Plus, MessageCircle } from 'lucide-react';
import { useApp } from '@/context/app-context';
import type { Task, Project, TaskStatus } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ComponentErrorBoundary } from '@/components/error-boundary';
import AddTaskDialog from './add-task-dialog';
import AddSubTaskDialog from './add-sub-task-dialog';
import CommentPromptModal from './comment-prompt-modal';
import { TaskComments } from '@/components/task/task-comments';
import { moveTaskToStatus } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { findProjectById } from '@/lib/projects';

// Helper function to get priority styling
const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return { emoji: '🔴', label: 'Urgent', className: 'bg-red-100 text-red-800 border-red-200' };
    case 'high':
      return { emoji: '🟠', label: 'High', className: 'bg-orange-100 text-orange-800 border-orange-200' };
    case 'medium':
      return { emoji: '🟡', label: 'Normal', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    case 'low':
      return { emoji: '🟢', label: 'Low', className: 'bg-green-100 text-green-800 border-green-200' };
    default:
      return { emoji: '🟡', label: 'Normal', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  }
};

type TaskItemProps = {
  task: Task;
  onDelete: (taskId: string) => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  canEdit?: boolean;
  showStatusSelector?: boolean;
};

const TaskItem = React.memo<TaskItemProps>(function TaskItem({ task, onDelete, onStatusChange, canEdit: canEditProp, showStatusSelector = true }) {
    const { users, updateTask, projects, currentUser, tasks, cardDensity } = useApp();
    const { toast } = useToast();
    const [menuOpen, setMenuOpen] = useState(false);
    const [isAddSubTaskDialogOpen, setAddSubTaskDialogOpen] = useState(false);
    const [commentModalOpen, setCommentModalOpen] = useState(false);
    const [commentsModalOpen, setCommentsModalOpen] = useState(false);
    const [pendingStatusChange, setPendingStatusChange] = useState<{
        newStatus: string;
        statusName: string;
        isRequired: boolean;
    } | null>(null);
    const editTriggerRef = useRef<HTMLButtonElement>(null);
    const subTaskEditTriggerRef = useRef<HTMLButtonElement>(null);
  const timeAgo = task.dueTime ? formatDistanceToNow(parseISO(task.dueTime), { addSuffix: true }) : null;

    const isSubTask = !!task.parentId;
    const assignee = task.assigneeId ? users.get(task.assigneeId) : undefined;
  const project = useMemo(() => findProjectById(projects, task.projectId), [projects, task.projectId]);
  const subTasks = useMemo(() => tasks.filter(t => t.parentId === task.id), [tasks, task.id]);
  const taskStatusOptions = useMemo(() => project?.taskStatusOptions || [], [project]);
  
  const internalCanEdit = useMemo(() => {
      if (!project || !currentUser) return false;
      if (!project.members) return false;
      const userRole = project.members[currentUser.id];
      return userRole === 'owner' || userRole === 'editor';
  }, [project, currentUser]);

  const canEdit = canEditProp !== undefined ? canEditProp : internalCanEdit;
  
    // ensure we have a valid status id; fallback to first option if necessary
    const currentStatus = task.status && typeof task.status === 'string' ? task.status : (taskStatusOptions[0]?.id ?? '');
    const status = useMemo(() => taskStatusOptions.find(o => o.id === currentStatus), [taskStatusOptions, currentStatus]);
    const isDone = useMemo(() => !!status?.showStrikeThrough, [status]);
    const isCompact = cardDensity === 'compact';

  const handleDelete = useCallback(() => {
    onDelete(task.id);
    setMenuOpen(false);
  }, [onDelete, task.id]);

  const handleStatusChange = useCallback((newStatus: TaskStatus) => {
    // Find the target status to check comment requirements
    const targetStatus = taskStatusOptions.find(s => s.id === newStatus);
    
    if (targetStatus) {
        // Business Rule 1: Check if parent task can move to target status
        // Parent tasks cannot move to a status with higher order than any of their sub-tasks
        if (!isSubTask && subTasks.length > 0) {
            const targetOrder = targetStatus.order;
            const hasSubTaskWithLowerOrder = subTasks.some(subTask => {
                const subTaskStatus = taskStatusOptions.find(s => s.id === subTask.status);
                return subTaskStatus && subTaskStatus.order < targetOrder;
            });
            
            if (hasSubTaskWithLowerOrder) {
                // Show error message and prevent the move
                toast({
                    variant: "destructive",
                    title: "Cannot move task",
                    description: "Parent tasks cannot be moved to a status higher than their sub-tasks. Please complete sub-tasks first.",
                });
                return;
            }
        }
        
        // Check comment requirements: Required OR Optional (but not Disabled)
        const shouldShowModal = targetStatus.requiresComment || 
                              (targetStatus.allowsComment && !targetStatus.requiresComment);
        
        if (shouldShowModal) {
            // Show comment modal
            setPendingStatusChange({
                newStatus,
                statusName: targetStatus.name,
                isRequired: !!targetStatus.requiresComment
            });
            setCommentModalOpen(true);
            return; // Don't proceed with status change yet
        }
    }
    
    // Proceed with direct status change (no comment required)
    if (onStatusChange) {
        onStatusChange(task.id, newStatus);
    } else {
        updateTask({ ...task, status: newStatus });
    }
  }, [taskStatusOptions, onStatusChange, task, updateTask, isSubTask, subTasks, toast]);

  const handleCommentConfirm = async (comment: string) => {
    if (pendingStatusChange) {
        try {
            // Use the new API endpoint that handles comment requirements
            await moveTaskToStatus(task.id, pendingStatusChange.newStatus, comment || undefined);
            
            // Also call the parent's onStatusChange if provided
            if (onStatusChange) {
                onStatusChange(task.id, pendingStatusChange.newStatus as TaskStatus);
            } else {
                updateTask({ ...task, status: pendingStatusChange.newStatus as TaskStatus });
            }
        } catch (error) {
            console.error('Failed to move task with comment:', error);
            // Fallback to direct status change
            if (onStatusChange) {
                onStatusChange(task.id, pendingStatusChange.newStatus as TaskStatus);
            } else {
                updateTask({ ...task, status: pendingStatusChange.newStatus as TaskStatus });
            }
        }
    }
    setCommentModalOpen(false);
    setPendingStatusChange(null);
  };

  const handleCommentCancel = useCallback(() => {
    setCommentModalOpen(false);
    setPendingStatusChange(null);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const stop = useCallback((e: React.SyntheticEvent) => { 
    e.stopPropagation(); 
  }, []);

  const handleEditClick = useCallback(() => {
    if (canEdit) {
      const triggerRef = isSubTask ? subTaskEditTriggerRef : editTriggerRef;
      if (triggerRef.current) {
        triggerRef.current.click();
      }
    }
  }, [canEdit, isSubTask]);

    const handleEditFromMenu = useCallback(() => {
        if (canEdit) {
            const triggerRef = isSubTask ? subTaskEditTriggerRef : editTriggerRef;
            if (triggerRef.current) {
                triggerRef.current.click();
            }
        }
    }, [canEdit, isSubTask]);

    const handleEditClose = useCallback(() => {
        setMenuOpen(false);
    }, []);    if (isSubTask) {
    return (
        <>
        <div 
            className={`relative rounded-md bg-white dark:bg-gray-800/50 border-l-4 ${isCompact ? 'p-0.5' : 'p-2'} flex flex-col ${isDone ? 'opacity-60' : ''} transition-all duration-200 ease-in-out transform`}
            style={{ borderLeftColor: status?.color || '#E5E7EB' }}
        >
            <div className="flex items-center justify-between">
                <p className={`${isCompact ? 'text-[10px]' : 'text-sm'} font-medium flex-grow ${isDone ? 'line-through' : ''}`}>{task.title}</p>
                        {canEdit && (
                            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={stop}>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); e.stopPropagation(); setCommentsModalOpen(true); setMenuOpen(false); }}>
                                        <MessageCircle className="mr-2 h-4 w-4" />
                                        <span>Comments</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); e.stopPropagation(); handleEditFromMenu(); setMenuOpen(false); }}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        <span>Edit</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(); setMenuOpen(false); }} className="text-red-500">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>Delete</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
            </div>

                {task.description && (
                <p className={`${isCompact ? 'text-[9px]' : 'text-[11px]'} text-gray-500 dark:text-gray-400 mt-1`} onClick={stop}>
                    {task.description}
                </p>
            )}

            <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                    {assignee && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Avatar className={isCompact ? 'h-3 w-3' : 'h-5 w-5'}>
                                        <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                                        <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{assignee.name}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    {(showStatusSelector || isSubTask) && taskStatusOptions.length > 0 &&
                        <Select value={currentStatus} onValueChange={handleStatusChange} disabled={!canEdit}>
                            <SelectTrigger className={`${isCompact ? 'w-20 h-5 text-[10px]' : 'w-28 h-7 text-xs'}`}>
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {taskStatusOptions.map(option => (
                                    <SelectItem key={option.id} value={option.id} style={{ color: option.color }}>
                                        {option.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    }
                </div>
                {timeAgo && 
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        Due {timeAgo}
                    </div>
                }
            </div>
                </div>
                
                {/* Edit Subtask Dialog - Hidden trigger */}
                <AddTaskDialog 
                    taskToEdit={task} 
                    onClose={handleEditClose}
                >
                    <button 
                        ref={subTaskEditTriggerRef}
                        style={{ display: 'none' }}
                        aria-hidden="true"
                    />
                </AddTaskDialog>
                
                {/* Task Comments Modal for Subtask */}
                <TaskComments
                  taskId={task.id}
                  isOpen={commentsModalOpen}
                  onClose={() => setCommentsModalOpen(false)}
                />
                                {/* Comment Prompt Modal for Subtask status changes */}
                                {pendingStatusChange && (
                                    <CommentPromptModal
                                        isOpen={commentModalOpen}
                                        onClose={handleCommentCancel}
                                        onConfirm={handleCommentConfirm}
                                        statusName={pendingStatusChange.statusName}
                                        taskTitle={task.title}
                                        isRequired={pendingStatusChange.isRequired}
                                    />
                                )}
        </>
        );
    }

  return (
    <>
        <Card 
        className={`mb-3 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow duration-200 border-l-4 overflow-visible ${isDone ? 'opacity-60' : ''} transition-all duration-200 ease-in-out transform`}
        style={{ borderLeftColor: status?.color || '#E5E7EB' }}
    >
        <CardHeader className={`flex flex-row items-center justify-between ${isCompact ? 'p-0.5' : 'p-2'}`}>
            <div className="flex items-center gap-2">
                {canEdit && <GripVertical className={`${isCompact ? 'h-3 w-3' : 'h-6 w-6'} text-gray-400 cursor-grab`} onClick={stop} />} 
                <CardTitle className={`${isCompact ? 'text-xs' : 'text-lg'} font-semibold ${isDone ? 'line-through' : ''}`}>{task.title}</CardTitle>
                {task.priority && (
                  <span 
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPriorityBadge(task.priority).className}`}
                    title={`Priority: ${getPriorityBadge(task.priority).label}`}
                  >
                    <span className="mr-1">{getPriorityBadge(task.priority).emoji}</span>
                    {!isCompact && getPriorityBadge(task.priority).label}
                  </span>
                )}
            </div>
            <div className="flex items-center">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => { 
                        e.preventDefault();
                        e.stopPropagation(); 
                        setCommentsModalOpen(true); 
                    }}
                    className={`${isCompact ? 'h-5 w-5' : 'h-8 w-8'}`}
                    title="View comments"
                >
                    <MessageCircle className={`${isCompact ? 'h-2.5 w-2.5' : 'h-4 w-4'}`} />
                </Button>
                {canEdit && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleEditFromMenu}
                        className={`${isCompact ? 'h-5 w-5' : 'h-8 w-8'}`}
                        title="Edit task"
                    >
                        <Pencil className={`${isCompact ? 'h-2.5 w-2.5' : 'h-4 w-4'}`} />
                    </Button>
                )}
                {canEdit && (
                    <AddSubTaskDialog parentTask={task} open={isAddSubTaskDialogOpen} onOpenChange={setAddSubTaskDialogOpen}>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => { 
                                e.preventDefault();
                                e.stopPropagation(); 
                                setAddSubTaskDialogOpen(true); 
                            }} 
                            className={`${isCompact ? 'h-5 w-5' : 'h-8 w-8'}`}
                        >
                            <Plus className={`${isCompact ? 'h-2.5 w-2.5' : 'h-4 w-4'}`} />
                        </Button>
                    </AddSubTaskDialog>
                )}
                {canEdit && (
                    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className={`${isCompact ? 'h-5 w-5' : 'h-8 w-8'}`} onClick={stop}>
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className={`${isCompact ? 'h-3 w-3' : 'h-5 w-5'}`} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); e.stopPropagation(); setCommentsModalOpen(true); setMenuOpen(false); }}>
                                <MessageCircle className="mr-2 h-4 w-4" />
                                <span>Comments</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); e.stopPropagation(); handleEditFromMenu(); setMenuOpen(false); }}>
                                <Pencil className="mr-2 h-4 w-4" />
                                <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="text-red-500">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </CardHeader>
        {task.description && 
            <CardContent className={`${isCompact ? 'p-0.5 pt-0' : 'p-2 pt-0'}`}>
                <p className="text-sm text-gray-600 dark:text-gray-300">{task.description}</p>
            </CardContent>
        }
        {subTasks.length > 0 && (
          <CardContent className={`${isCompact ? 'p-0.5 pt-0' : 'p-2 pt-0'}`}>
              <h4 className="text-sm font-semibold mb-2">Sub-tasks</h4>
              <div className="space-y-2">
                  {subTasks.map(subTask => (
                      <ComponentErrorBoundary key={subTask.id}>
                          <TaskItem task={subTask} onDelete={onDelete} onStatusChange={onStatusChange} canEdit={canEdit} showStatusSelector={true} />
                      </ComponentErrorBoundary>
                  ))}
              </div>
          </CardContent>
        )}
        <CardFooter className={`flex justify-between items-center ${isCompact ? 'p-0.5' : 'p-2'} bg-gray-50 dark:bg-gray-900/50`}>
            <div className={`flex items-center ${isCompact ? 'gap-1 text-[10px]' : 'gap-3 text-xs'} text-gray-500 dark:text-gray-400`}>
                {timeAgo && <span>Due {timeAgo}</span>}
                {project && <span>Project: {project.name}</span>}
            </div>
            <div className={`flex items-center ${isCompact ? 'gap-1' : 'gap-3'}`}>
                {assignee && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Avatar className={isCompact ? 'h-5 w-5' : 'h-6 w-6'}>
                                    <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                                    <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{assignee.name}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {showStatusSelector && taskStatusOptions.length > 0 &&
                  <Select value={currentStatus} onValueChange={handleStatusChange} disabled={!canEdit}>
                      <SelectTrigger className={`${isCompact ? 'w-28 h-6 text-xs' : 'w-40 h-9 text-sm'}`}>
                          <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                          {taskStatusOptions.map(option => (
                              <SelectItem key={option.id} value={option.id} style={{ color: option.color }}>
                                  {option.name}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                }
            </div>
        </CardFooter>
        </Card>
        
        {/* Edit Task Dialog - Hidden trigger */}
        <AddTaskDialog 
            taskToEdit={task} 
            onClose={handleEditClose}
        >
            <button 
                ref={editTriggerRef}
                style={{ display: 'none' }}
                aria-hidden="true"
            />
        </AddTaskDialog>
        
        {/* Comment Prompt Modal */}
        {pendingStatusChange && (
          <CommentPromptModal
            isOpen={commentModalOpen}
            onClose={handleCommentCancel}
            onConfirm={handleCommentConfirm}
            statusName={pendingStatusChange.statusName}
            taskTitle={task.title}
            isRequired={pendingStatusChange.isRequired}
          />
        )}
        
        {/* Task Comments Modal */}
        <TaskComments
          taskId={task.id}
          isOpen={commentsModalOpen}
          onClose={() => setCommentsModalOpen(false)}
        />
    </>
    );
});

export default TaskItem;
