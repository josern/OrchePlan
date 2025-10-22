'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useApp } from '../../context/app-context';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, GripVertical, Trash2, Edit, Eye, EyeOff } from 'lucide-react';
import { Switch } from '../ui/switch';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskStatusOption } from '../../lib/types';
import { findProjectById } from '../../lib/projects';

// Helper functions to convert between comment settings
const getCommentSetting = (requiresComment?: boolean, allowsComment?: boolean): 'disabled' | 'optional' | 'required' => {
  if (requiresComment) return 'required';
  if (allowsComment) return 'optional';
  return 'disabled';
};

const getCommentFlags = (setting: 'disabled' | 'optional' | 'required') => {
  switch (setting) {
    case 'required':
      return { requiresComment: true, allowsComment: true };
    case 'optional':
      return { requiresComment: false, allowsComment: true };
    case 'disabled':
    default:
      return { requiresComment: false, allowsComment: false };
  }
};

const statusSchema = z.object({
  name: z.string().min(2, { message: "Status name must be at least 2 characters." }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: "Color must be a valid hex code." }),
  showStrikeThrough: z.boolean().optional(),
  hidden: z.boolean().optional(),
  commentSetting: z.enum(['disabled', 'optional', 'required']).optional(),
});

function SortableStatusItem({
    status,
    onEdit,
    onDelete,
    onToggleVisibility,
} : {
    status: TaskStatusOption;
    onEdit: (status: TaskStatusOption) => void;
    onDelete: (id: string) => Promise<void>;
    onToggleVisibility: (id: string, hidden: boolean) => Promise<void>;
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: status.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} className={`flex items-center gap-2 p-2 rounded-md bg-muted/50 ${status.hidden ? 'opacity-60' : ''}`}>
            <div {...listeners} className="cursor-grab p-1">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: status.color }}></div>
            <span className={`flex-grow ${status.showStrikeThrough ? 'line-through' : ''}`}>{status.name}</span>
            {status.showStrikeThrough && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Strike-through</span>
            )}
            {status.hidden && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Hidden</span>
            )}
            {status.requiresComment && (
                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                    💬 Required
                </span>
            )}
            {status.allowsComment && !status.requiresComment && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    💬 Optional
                </span>
            )}
            {!status.allowsComment && !status.requiresComment && (
                <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                    💬 Disabled
                </span>
            )}
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onToggleVisibility(status.id, !status.hidden)} 
                className="text-muted-foreground hover:text-primary"
                title={status.hidden ? "Show column in board view" : "Hide column in board view"}
            >
                {status.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onEdit(status)} className="text-muted-foreground hover:text-primary">
                <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(status.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
}

export default function ProjectManageStatuses() {
  const { projects, addProjectTaskStatus, updateProjectTaskStatus, deleteProjectTaskStatus, updateProjectTaskStatusOrder } = useApp();
  const params = useParams();
  if (!params || !params.projectId) {
    return null;
  }
  const projectId = params.projectId as string;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<TaskStatusOption | null>(null);

  const form = useForm<z.infer<typeof statusSchema>>({
    resolver: zodResolver(statusSchema),
    defaultValues: {
        name: '',
        color: '#3B82F6',
        showStrikeThrough: false,
        hidden: false,
        commentSetting: 'disabled',
    }
  });

  // Get statuses directly from context instead of maintaining local state
  const project = useMemo(() => findProjectById(projects, projectId), [projects, projectId]);
  const projectStatuses = useMemo(() => project?.taskStatusOptions || [], [project]);

  const handleAdd = () => {
    setEditingStatus(null);
    form.reset({ name: '', color: '#3B82F6', showStrikeThrough: false, hidden: false, commentSetting: 'disabled' });
    setIsDialogOpen(true);
  };
  
  const handleEdit = (status: TaskStatusOption) => {
    setEditingStatus(status);
    form.reset({ 
      name: status.name, 
      color: status.color || '#3B82F6', 
      showStrikeThrough: status.showStrikeThrough || false,
      hidden: status.hidden || false,
      commentSetting: getCommentSetting(status.requiresComment, status.allowsComment)
    });
    setIsDialogOpen(true);
  };

  const handleToggleVisibility = async (statusId: string, hidden: boolean) => {
    await updateProjectTaskStatus(projectId, statusId, { hidden });
  };
  
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this status?')) {
        await deleteProjectTaskStatus(projectId, id);
    }
  };
  
  const onSubmit = async (data: z.infer<typeof statusSchema>) => {
    const commentFlags = getCommentFlags(data.commentSetting || 'disabled');
    
    if (editingStatus) {
      await updateProjectTaskStatus(projectId, editingStatus.id, {
        name: data.name,
        color: data.color,
        showStrikeThrough: data.showStrikeThrough,
        hidden: data.hidden,
        ...commentFlags
      });
    } else {
      await addProjectTaskStatus(projectId, {
        name: data.name,
        color: data.color,
        order: projectStatuses.length,
        // when creating via UI, respect the checkbox if present
        showStrikeThrough: data.showStrikeThrough,
        hidden: data.hidden,
        ...commentFlags
      } as any);
    }
    setIsDialogOpen(false);
    setEditingStatus(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = projectStatuses.findIndex((s) => s.id === active.id);
        const newIndex = projectStatuses.findIndex((s) => s.id === over.id);
        const newOrder = arrayMove(projectStatuses, oldIndex, newIndex).map((status, index) => ({
            ...status,
            order: index
        }));
        
        // Update status order via context (optimistic update)
        await updateProjectTaskStatusOrder(projectId, newOrder);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Manage Project Task Statuses</CardTitle>
          <CardDescription>Customize and re-order the statuses for this project&apos;s tasks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={projectStatuses.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                      {projectStatuses.map((status) => (
                          <SortableStatusItem
                              key={status.id}
                              status={status}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              onToggleVisibility={handleToggleVisibility}
                          />
                      ))}
                  </div>
              </SortableContext>
          </DndContext>
          <Button onClick={handleAdd} className="mt-4">
            <Plus className="mr-2 h-4 w-4" />
            Add New Status
          </Button>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStatus ? 'Edit Status' : 'Add New Status'}</DialogTitle>
            <DialogDescription>
              {editingStatus ? 'Update the details for this status.' : 'Create a new status for your tasks.'}
            </DialogDescription>
          </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Status Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., In Review" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="color"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Color</FormLabel>
                                <FormControl>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="color"
                                            className="p-1 h-10 w-14"
                                            {...field}
                                        />
                                        <Input
                                            className="flex-grow"
                                            {...field}
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
          <FormField
            control={form.control}
            name="showStrikeThrough"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Strike-through on tasks</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!field.value} onCheckedChange={(v) => field.onChange(v)} />
                    <span className="text-sm text-muted-foreground">Apply a line-through to tasks using this status</span>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="hidden"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hide column in board view</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!field.value} onCheckedChange={(v) => field.onChange(v)} />
                    <span className="text-sm text-muted-foreground">Hide this status column from the Kanban board view</span>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="commentSetting"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Comment requirements</FormLabel>
                <FormControl>
                  <Select value={field.value || 'disabled'} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select comment setting" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disabled">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">💬 Disabled</span>
                          <span>No comments allowed</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="optional">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">💬 Optional</span>
                          <span>Allow optional comments</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="required">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">💬 Required</span>
                          <span>Require comment when moving tasks</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button type="submit">{editingStatus ? 'Save Changes' : 'Add Status'}</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
