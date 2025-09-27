'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useApp } from '../../context/app-context';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, GripVertical, Trash2, Edit } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskStatusOption } from '../../lib/types';
import { findProjectById } from '../../lib/projects';

const statusSchema = z.object({
  name: z.string().min(2, { message: "Status name must be at least 2 characters." }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: "Color must be a valid hex code." }),
});

function SortableStatusItem({
    status,
    onEdit,
    onDelete,
} : {
    status: TaskStatusOption;
    onEdit: (status: TaskStatusOption) => void;
    onDelete: (id: string) => Promise<void>;
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: status.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <div {...listeners} className="cursor-grab p-1">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: status.color }}></div>
            <span className="flex-grow">{status.name}</span>
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
  const projectId = params.projectId as string;

  const [projectStatuses, setProjectStatuses] = useState<TaskStatusOption[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<TaskStatusOption | null>(null);

  const form = useForm<z.infer<typeof statusSchema>>({
    resolver: zodResolver(statusSchema),
    defaultValues: {
        name: '',
        color: '#3B82F6',
    }
  });

  useEffect(() => {
    const project = findProjectById(projects, projectId);
    if (project && project.taskStatusOptions) {
      setProjectStatuses(project.taskStatusOptions);
    }
  }, [projects, projectId]);

  const handleAdd = () => {
    setEditingStatus(null);
    form.reset({ name: '', color: '#3B82F6' });
    setIsDialogOpen(true);
  };
  
  const handleEdit = (status: TaskStatusOption) => {
    setEditingStatus(status);
    form.reset({ name: status.name, color: status.color || '#3B82F6' });
    setIsDialogOpen(true);
  };
  
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this status?')) {
        await deleteProjectTaskStatus(projectId, id);
    }
  };
  
  const onSubmit = async (data: z.infer<typeof statusSchema>) => {
    if (editingStatus) {
      await updateProjectTaskStatus(projectId, editingStatus.id, {
        name: data.name,
        color: data.color
      });
    } else {
      await addProjectTaskStatus(projectId, {
        name: data.name,
        color: data.color,
        order: projectStatuses.length,
      });
    }
    setIsDialogOpen(false);
    setEditingStatus(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = projectStatuses.findIndex((s) => s.id === active.id);
        const newIndex = projectStatuses.findIndex((s) => s.id === over.id);
        const newOrder = arrayMove(projectStatuses, oldIndex, newIndex);
        setProjectStatuses(newOrder);
        updateProjectTaskStatusOrder(projectId, newOrder);
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
