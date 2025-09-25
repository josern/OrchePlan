'use client';

import { useState } from 'react';
import { useApp } from '@/context/app-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskStatusOption } from '@/lib/types';

const statusSchema = z.object({
  name: z.string().min(2, { message: "Status name must be at least 2 characters." }),
});

function SortableStatusItem({
    status,
    editingId,
    editingName,
    handleEdit,
    handleUpdate,
    handleDelete,
    setEditingName,
} : {
    status: TaskStatusOption;
    editingId: string | null;
    editingName: string;
    handleEdit: (id: string, name: string) => void;
    handleUpdate: () => Promise<void>;
    handleDelete: (id: string) => Promise<void>;
    setEditingName: (name: string) => void;
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
            {editingId === status.id ? (
                <Input 
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleUpdate}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                    autoFocus
                    className="flex-grow"
                />
            ) : (
                <span className="flex-grow cursor-pointer" onClick={() => handleEdit(status.id, status.name)}>{status.name}</span>
            )}
            <Button variant="ghost" size="icon" onClick={() => handleDelete(status.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
}


export default function ManageStatuses() {
  const { taskStatusOptions, addTaskStatus, updateTaskStatus, deleteTaskStatus, setTaskStatusOptions, updateTaskStatusOrder } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const form = useForm({
    resolver: zodResolver(statusSchema),
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = taskStatusOptions.findIndex((s) => s.id === active.id);
        const newIndex = taskStatusOptions.findIndex((s) => s.id === over.id);
        const newOrder = arrayMove(taskStatusOptions, oldIndex, newIndex);
        setTaskStatusOptions(newOrder);
        updateTaskStatusOrder(newOrder);
    }
  };

  const handleAdd = () => {
    form.reset();
    setIsAdding(true);
  };

  const onSubmit = async (data: { name: string }) => {
    await addTaskStatus({
      name: data.name,
      color: '',
      order: 0
    });
    setIsAdding(false);
  };

  const handleEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleUpdate = async () => {
    if (editingId && editingName) {
      await updateTaskStatus(editingId, { name: editingName });
      setEditingId(null);
      setEditingName('');
    }
  };
  
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this status?')) {
        await deleteTaskStatus(id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Task Statuses</CardTitle>
        <CardDescription>Customize and re-order the statuses for your project tasks.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={taskStatusOptions.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                    {taskStatusOptions.map((status) => (
                        <SortableStatusItem
                            key={status.id}
                            status={status}
                            editingId={editingId}
                            editingName={editingName}
                            handleEdit={handleEdit}
                            handleUpdate={handleUpdate}
                            handleDelete={handleDelete}
                            setEditingName={setEditingName}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
        {isAdding ? (
           <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Status</DialogTitle>
                <DialogDescription>Create a new status for your tasks.</DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  placeholder="New status name"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p className="text-red-500 text-sm">{form.formState.errors.name.message}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                  <Button type="submit">Add Status</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        ) : (
          <Button onClick={handleAdd} className="mt-2">
            <Plus className="mr-2 h-4 w-4" />
            Add New Status
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
