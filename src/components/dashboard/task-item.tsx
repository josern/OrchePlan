'use client';

import { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { GripVertical, MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react';
import { useApp } from '@/context/app-context';
import type { Task, Project, TaskStatus } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AddTaskDialog from './add-task-dialog';
import AddSubTaskDialog from './add-sub-task-dialog';
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

type TaskItemProps = {
  task: Task;
  onDelete: (taskId: string) => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  canEdit?: boolean;
  showStatusSelector?: boolean;
};

export default function TaskItem({ task, onDelete, onStatusChange, canEdit: canEditProp, showStatusSelector = true }: TaskItemProps) {
  const { users, updateTask, projects, currentUser, tasks } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAddSubTaskDialogOpen, setAddSubTaskDialogOpen] = useState(false);
  const timeAgo = task.dueTime ? formatDistanceToNow(parseISO(task.dueTime), { addSuffix: true }) : null;

  const isSubTask = !!task.parentId;
  const assignee = users.find(u => u.id === task.assigneeId);
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
  
  const currentStatus = task.status || 'todo';
  const status = useMemo(() => taskStatusOptions.find(o => o.id === currentStatus), [taskStatusOptions, currentStatus]);
  const isDone = useMemo(() => status?.name.toLowerCase() === 'done', [status]);

  const handleDelete = () => {
    onDelete(task.id);
    setMenuOpen(false);
  }

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (onStatusChange) {
        onStatusChange(task.id, newStatus);
    } else {
        updateTask({ ...task, status: newStatus });
    }
  }

  const handleMenuClose = () => {
    setMenuOpen(false);
  }

  if (isSubTask) {
    return (
        <div 
            className={`relative rounded-md bg-white dark:bg-gray-800/50 border-l-4 p-2 flex flex-col ${isDone ? 'opacity-60' : ''}`}
            style={{ borderLeftColor: status?.color || '#E5E7EB' }}
        >
            <div className="flex items-center justify-between">
                <p className={`text-sm font-medium flex-grow ${isDone ? 'line-through' : ''}`}>{task.title}</p>
                {canEdit && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <AddTaskDialog taskToEdit={task} onClose={() => {}}>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    <span>Edit</span>
                                </DropdownMenuItem>
                            </AddTaskDialog>
                            <DropdownMenuItem onClick={handleDelete} className="text-red-500">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {task.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {task.description}
                </p>
            )}

            <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                    {assignee && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Avatar className="h-6 w-6">
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
                            <SelectTrigger className="w-32 h-8 text-xs">
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
    );
  }

  return (
    <Card 
        className={`mb-4 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow duration-200 border-l-4 overflow-visible ${isDone ? 'opacity-60' : ''}`}
        style={{ borderLeftColor: status?.color || '#E5E7EB' }}
    >
        <CardHeader className="flex flex-row items-center justify-between p-4">
            <div className="flex items-center gap-2">
                {canEdit && <GripVertical className="h-5 w-5 text-gray-400 cursor-grab" />} 
                <CardTitle className={`text-lg font-semibold ${isDone ? 'line-through' : ''}`}>{task.title}</CardTitle>
            </div>
            <div className="flex items-center">
                {canEdit && (
                    <AddSubTaskDialog parentTask={task} open={isAddSubTaskDialogOpen} onOpenChange={setAddSubTaskDialogOpen}>
                        <Button variant="ghost" size="icon" onClick={() => setAddSubTaskDialogOpen(true)}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </AddSubTaskDialog>
                )}
                {canEdit && (
                    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <AddTaskDialog taskToEdit={task} onClose={handleMenuClose}>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    <span>Edit</span>
                                </DropdownMenuItem>
                            </AddTaskDialog>
                            <DropdownMenuItem onClick={handleDelete} className="text-red-500">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </CardHeader>
        {task.description && 
            <CardContent className="p-4 pt-0">
                <p className="text-sm text-gray-600 dark:text-gray-300">{task.description}</p>
            </CardContent>
        }
        {subTasks.length > 0 && (
          <CardContent className="p-4 pt-0">
              <h4 className="text-sm font-semibold mb-2">Sub-tasks</h4>
              <div className="space-y-2">
                  {subTasks.map(subTask => (
                      <TaskItem key={subTask.id} task={subTask} onDelete={onDelete} onStatusChange={onStatusChange} canEdit={canEdit} showStatusSelector={true} />
                  ))}
              </div>
          </CardContent>
        )}
        <CardFooter className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                {timeAgo && <span>Due {timeAgo}</span>}
                {project && <span>Project: {project.name}</span>}
            </div>
            <div className="flex items-center gap-4">
                {assignee && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Avatar className="h-8 w-8">
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
                      <SelectTrigger className="w-36">
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
  );
}
