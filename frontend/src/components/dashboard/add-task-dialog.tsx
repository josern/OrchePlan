
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { Calendar } from '../ui/calendar';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import type { Task, Project, TaskStatus, User } from '../../lib/types';
import { useApp } from '../../context/app-context';
import { findProjectById } from '../../lib/projects';
import { moveTaskToStatus } from '../../lib/api';
import CommentPromptModal from './comment-prompt-modal';
import { getCommentRequirement } from '../../lib/comment-utils';
import { useModal } from '@/context/modal-context';

const taskFormSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters.'),
  description: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  projectId: z.string({ required_error: 'Please select a project.' }),
  assigneeId: z.string().optional(),
  dueTime: z.date().optional(),
  status: z.string({ required_error: 'Please select a status.' }),
});

type AddTaskDialogProps = {
    children: React.ReactNode;
    taskToEdit?: Task;
    defaultProjectId?: string;
    onClose?: () => void;
};

export default function AddTaskDialog({ children, taskToEdit, defaultProjectId, onClose }: AddTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const { projects, users, addTask, updateTask, currentUser } = useApp();
  
  // Comment prompt modal state
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [pendingTaskData, setPendingTaskData] = useState<any>(null);
  const [isStatusChangeRequired, setIsStatusChangeRequired] = useState(false);
  // modal registry (optional)
  const modal = (() => { try { return useModal(); } catch (e) { return null; } })();
  
  const form = useForm<z.infer<typeof taskFormSchema>>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'normal',
      projectId: defaultProjectId ?? '',
      assigneeId: '',
      dueTime: undefined,
      // start empty; we'll set a sensible default when project statuses load
      status: '',
    },
  });

  // watch projectId from the same form instance so selects update correctly
  const selectedProjectId = form.watch('projectId', defaultProjectId);

  const projectTaskStatuses = useMemo(() => {
    const project = findProjectById(projects, selectedProjectId);
    return project?.taskStatusOptions || [];
  }, [selectedProjectId, projects]);

  const defaultStatusId = useMemo(() => {
    return projectTaskStatuses.find(s => s.name.toLowerCase() === 'to do')?.id || projectTaskStatuses[0]?.id || '';
  }, [projectTaskStatuses]);

  // when project selection changes, ensure the status field is initialized to a sensible default
  // but don't override an explicit value when editing an existing task
  useEffect(() => {
    try {
      const current = form.getValues().status as string | undefined;
      if (!taskToEdit) {
        if (!current || current === '') {
          if (defaultStatusId) form.setValue('status', defaultStatusId);
        } else {
          // if the current status does not belong to this project, reset to default
          const belongs = projectTaskStatuses.some(s => s.id === current);
          if (!belongs && defaultStatusId) form.setValue('status', defaultStatusId);
        }
      }
    } catch (e) {
      // non-fatal
    }
  }, [selectedProjectId, defaultStatusId, projectTaskStatuses, taskToEdit, form]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen && onClose) {
      onClose();
    }
  };

  // Track if form has been initialized to prevent overwrites during editing
  const [formInitialized, setFormInitialized] = useState(false);

  useEffect(() => {
    if (open && !formInitialized) {
      const initialValues = {
        title: taskToEdit?.title ?? '',
        description: taskToEdit?.description ?? '',
        priority: taskToEdit?.priority ?? 'normal',
        projectId: taskToEdit?.projectId ?? defaultProjectId ?? '',
        assigneeId: taskToEdit?.assigneeId ?? '',
        dueTime: taskToEdit?.dueTime ? new Date(taskToEdit.dueTime) : undefined,
        status: taskToEdit?.status ?? defaultStatusId,
      };
      form.reset(initialValues);
      setFormInitialized(true);
    } else if (!open) {
      // Reset initialization flag when dialog closes
      setFormInitialized(false);
    }
  }, [open, taskToEdit, defaultProjectId, form, defaultStatusId, formInitialized]);

  const availableAssignees = useMemo(() => {
    if (!selectedProjectId) return [];
    const project = findProjectById(projects, selectedProjectId);
    if (!project) return [];
    const memberIds = Object.keys(project.members);
    return Array.from(users.values()).filter(user => memberIds.includes(user.id));
  }, [selectedProjectId, projects, users]);

  // Determine if current user can edit tasks in the selected project
  const canEditTask = useMemo(() => {
    if (!selectedProjectId || !currentUser) return false;
    const project = findProjectById(projects, selectedProjectId);
    if (!project || !project.members) return false;
    const userRole = project.members[currentUser.id];
    return userRole === 'owner' || userRole === 'editor';
  }, [selectedProjectId, projects, currentUser]);

  // For editing existing tasks, check the task's project
  const canEditCurrentTask = useMemo(() => {
    if (!taskToEdit || !currentUser) return true; // Allow creating new tasks by default
    const project = findProjectById(projects, taskToEdit.projectId);
    if (!project || !project.members) return false;
    const userRole = project.members[currentUser.id];
    return userRole === 'owner' || userRole === 'editor';
  }, [taskToEdit, projects, currentUser]);

  const flattenProjects = (projectList: Project[], currentUser: User | null, parentName = ''): {id: string, name: string}[] => {
    let all: {id: string, name: string}[] = [];
    for (const p of projectList) {
        const userRole = currentUser ? p.members[currentUser.id] : undefined;
        const canEdit = userRole === 'owner' || userRole === 'editor';
        if (canEdit) {
            const currentName = parentName ? `${parentName} / ${p.name}` : p.name;
            all.push({id: p.id, name: currentName});
        }
        if (p.subProjects) {
            all = all.concat(flattenProjects(p.subProjects, currentUser, parentName ? `${parentName} / ${p.name}` : p.name));
        }
    }
    return all;
  };
  const allProjectsForSelect = flattenProjects(projects, currentUser);

  const handleCommentConfirm = async (comment?: string) => {
    if (!pendingTaskData) return;
    
    try {
      if (pendingTaskData.isEdit && pendingTaskData.originalTask) {
        // First update the task with all changes except status
        const { status, ...updateData } = pendingTaskData.taskData;
        await updateTask({ ...pendingTaskData.originalTask, ...updateData });
        
        // Then handle the status change with comment if status changed
        if (status !== pendingTaskData.originalTask.status) {
          await moveTaskToStatus(pendingTaskData.originalTask.id, status, comment);
        }
      } else {
        // For new tasks, just create normally
        await addTask(pendingTaskData.taskData);
      }
      
      form.reset();
      handleOpenChange(false);
    } catch (error) {
      console.error('Failed to save task:', error);
    } finally {
      setPendingTaskData(null);
      setIsCommentModalOpen(false);
    }
  };

  async function onSubmit(values: z.infer<typeof taskFormSchema>) {
    const taskData = {
        ...values,
        dueTime: values.dueTime ? values.dueTime.toISOString() : undefined,
        assigneeId: values.assigneeId === 'unassigned' ? undefined : values.assigneeId,
    };

    if (taskToEdit) {
      // Check if status has changed and requires comment
      const statusChanged = values.status !== taskToEdit.status;
      
      if (statusChanged) {
        // Get the target project to find status options
        const targetProject = findProjectById(projects, values.projectId);
        if (targetProject && targetProject.taskStatusOptions) {
          const targetStatus = targetProject.taskStatusOptions.find(s => s.id === values.status);
          
            if (targetStatus) {
            const { shouldShowModal, isRequired, statusName } = await import('../../lib/comment-utils').then(m => m.getCommentRequirement(values.status, targetProject.taskStatusOptions || []));

            if (shouldShowModal) {
              // Show comment modal
              setPendingTaskData({
                isEdit: true,
                originalTask: taskToEdit,
                taskData,
              });
              setIsStatusChangeRequired(isRequired || false);
              // status change requires comment: show prompt
              if (modal) {
                modal.closeAll();
                modal.showModal(
                  <CommentPromptModal
                    isOpen={true}
                    onClose={() => { /* closed by modalId when available */ }}
                    onConfirm={handleCommentConfirm}
                    statusName={statusName || targetStatus.name}
                    taskTitle={taskToEdit.title}
                    isRequired={!!isRequired}
                  />
                );
              } else {
                setIsCommentModalOpen(true);
              }
              return; // Don't proceed immediately
            }
          }
        }
      }
      
      // If no comment required or status didn't change, proceed normally
      await updateTask({ ...taskToEdit, ...taskData });
    } else {
      // For new tasks, no comment checking needed
      await addTask(taskData);
    }
    
    form.reset();
    handleOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{taskToEdit ? 'Edit Task' : 'Add New Task'}</DialogTitle>
          <DialogDescription>
            {taskToEdit ? 
              (canEditCurrentTask ? 'Update the details of your task.' : 'View task details. You need editor or owner access to make changes.') : 
              (canEditTask ? 'Fill in the details for your new task.' : 'You need editor or owner access to create tasks in this project.')
            }
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Finalize the Q3 report" 
                      {...field} 
                      disabled={taskToEdit ? !canEditCurrentTask : !canEditTask}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add more details about the task..." 
                      {...field} 
                      disabled={taskToEdit ? !canEditCurrentTask : !canEditTask}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || 'normal'} 
                    disabled={taskToEdit ? !canEditCurrentTask : !canEditTask}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">🟢 Low</SelectItem>
                      <SelectItem value="normal">🟡 Normal</SelectItem>
                      <SelectItem value="high">🟠 High</SelectItem>
                      <SelectItem value="urgent">🔴 Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Project</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ''} 
                          disabled={taskToEdit ? !canEditCurrentTask : !canEditTask}
                        >
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a project" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {allProjectsForSelect.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                  control={form.control}
                  name="assigneeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign To</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ''} 
                        disabled={!selectedProjectId || (taskToEdit ? !canEditCurrentTask : !canEditTask)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a user" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {availableAssignees.map(user => (
                            <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dueTime"
                render={({ field }) => {
                    const handleDateChange = (date: Date | undefined) => {
                        if (!date) {
                            field.onChange(undefined);
                            return;
                        }
                        const newDate = new Date(date);
                        const currentVal = field.value;
                        if (currentVal) {
                            newDate.setHours(currentVal.getHours());
                            newDate.setMinutes(currentVal.getMinutes());
                        }
                        field.onChange(newDate);
                    };

                    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                        const time = e.target.value;
                        if (!time) return;

                        const [hours, minutes] = time.split(':').map(Number);
                        const currentVal = field.value;
                        const newDate = currentVal ? new Date(currentVal) : new Date();
                        newDate.setHours(hours);
                        newDate.setMinutes(minutes);
                        field.onChange(newDate);
                    };

                    return (
                        <FormItem className="flex flex-col">
                            <FormLabel>Due Date (Optional)</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={'outline'}
                                    className={cn(
                                    'w-full justify-start text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                    )}
                                    disabled={taskToEdit ? !canEditCurrentTask : !canEditTask}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, 'dd-MMM-yyyy HH:mm') : <span>Pick a date</span>}
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={handleDateChange}
                                disabled={taskToEdit ? !canEditCurrentTask : !canEditTask}
                                />
                                <div className="p-2 border-t">
                                    <Input
                                        type="time"
                                        value={field.value ? format(field.value, 'HH:mm') : ''}
                                        onChange={handleTimeChange}
                                        disabled={taskToEdit ? !canEditCurrentTask : !canEditTask}
                                    />
                                </div>
                                <div className="p-2 border-t">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="w-full" 
                                      onClick={() => field.onChange(undefined)}
                                      disabled={taskToEdit ? !canEditCurrentTask : !canEditTask}
                                    >
                                      Clear
                                    </Button>
                                </div>
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    );
                }}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={taskToEdit ? !canEditCurrentTask : !canEditTask}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projectTaskStatuses.map(status => (
                            <SelectItem key={status.id} value={status.id} className="capitalize">{status.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={taskToEdit ? !canEditCurrentTask : !canEditTask}
              >
                {taskToEdit ? 'Save Changes' : 'Create Task'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    
    <CommentPromptModal
      isOpen={isCommentModalOpen}
      onClose={() => {
        setIsCommentModalOpen(false);
        setPendingTaskData(null);
      }}
      onConfirm={handleCommentConfirm}
      isRequired={isStatusChangeRequired}
    />
    </>
  );
}
