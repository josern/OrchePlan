
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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '../ui/textarea';
import type { Task, Project, TaskStatus, User } from '@/lib/types';
import { useApp } from '@/context/app-context';
import { findProjectById } from '@/lib/projects';

const taskFormSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters.'),
  description: z.string().optional(),
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
  const { projects, users, addTask, updateTask, taskStatusOptions, currentUser } = useApp();

  const defaultStatusId = useMemo(() => {
    return taskStatusOptions.find(s => s.name.toLowerCase() === 'to do')?.id || taskStatusOptions[0]?.id || '';
  }, [taskStatusOptions]);

  const form = useForm<z.infer<typeof taskFormSchema>>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      projectId: defaultProjectId ?? '',
      assigneeId: '',
      dueTime: undefined,
      status: defaultStatusId,
    },
  });

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen && onClose) {
      onClose();
    }
  };

  useEffect(() => {
    if (open) {
      const initialValues = {
        title: taskToEdit?.title ?? '',
        description: taskToEdit?.description ?? '',
        projectId: taskToEdit?.projectId ?? defaultProjectId ?? '',
        assigneeId: taskToEdit?.assigneeId ?? '',
        dueTime: taskToEdit?.dueTime ? new Date(taskToEdit.dueTime) : undefined,
        status: taskToEdit?.status ?? defaultStatusId,
      };
      form.reset(initialValues);
    }
  }, [open, taskToEdit, defaultProjectId, form, defaultStatusId]);

  const selectedProjectId = form.watch('projectId');

  const availableAssignees = useMemo(() => {
    if (!selectedProjectId) return [];
    const project = findProjectById(projects, selectedProjectId);
    if (!project) return [];
    const memberIds = Object.keys(project.members);
    return users.filter(user => memberIds.includes(user.id));
  }, [selectedProjectId, projects, users]);

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

  async function onSubmit(values: z.infer<typeof taskFormSchema>) {
    const taskData = {
        ...values,
        dueTime: values.dueTime ? values.dueTime.toISOString() : undefined,
        assigneeId: values.assigneeId === 'unassigned' ? undefined : values.assigneeId,
    };

    if (taskToEdit) {
      await updateTask({ ...taskToEdit, ...taskData });
    } else {
      await addTask(taskData);
    }
    form.reset();
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{taskToEdit ? 'Edit Task' : 'Add New Task'}</DialogTitle>
          <DialogDescription>
            {taskToEdit ? 'Update the details of your task.' : 'Fill in the details for your new task.'}
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
                    <Input placeholder="e.g., Finalize the Q3 report" {...field} />
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
                    <Textarea placeholder="Add more details about the task..." {...field} />
                  </FormControl>
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
                        <Select onValueChange={field.onChange} value={field.value || ''}>
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
                      <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedProjectId}>
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
                render={({ field }) => (
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
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                        <div className="p-2 border-t">
                            <Button variant="ghost" size="sm" className="w-full" onClick={() => form.setValue('dueTime', undefined)}>Clear</Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {taskStatusOptions.map(status => (
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
              <Button type="submit">{taskToEdit ? 'Save Changes' : 'Create Task'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
