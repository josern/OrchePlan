'use client';

import React, { useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useApp } from '@/context/app-context';
import type { Task } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface AddSubTaskDialogProps {
  parentTask: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

const AddSubTaskDialog = memo<AddSubTaskDialogProps>(function AddSubTaskDialog({ parentTask, open, onOpenChange, children }: AddSubTaskDialogProps) {
  const { addTask, updateTask, projects } = useApp();
  const { toast } = useToast();
  const [title, setTitle] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    // Find the project to get task status options
    const project = projects.find(p => p.id === parentTask.projectId);
    
    const newSubTask: Omit<Task, 'id'> = {
      title,
      priority: parentTask.priority || 'normal', // Inherit parent's priority or default to medium
      projectId: parentTask.projectId,
      assigneeId: parentTask.assigneeId,
      parentId: parentTask.id,
      // inherit parent's status id when creating a sub-task if available
      status: parentTask.status ?? undefined,
    };

    await addTask(newSubTask);
    
    // Business Rule 2: Move parent task back to first status when adding sub-task
    if (project?.taskStatusOptions && project.taskStatusOptions.length > 0) {
      // Find the status with the lowest order (first status)
      const firstStatus = project.taskStatusOptions
        .filter(status => !status.hidden)
        .sort((a, b) => a.order - b.order)[0];
      
      if (firstStatus && parentTask.status !== firstStatus.id) {
        await updateTask({ ...parentTask, status: firstStatus.id });
        toast({
          title: "Parent task status updated",
          description: `Parent task moved back to "${firstStatus.name}" status after adding sub-task.`,
        });
      }
    }
    
    onOpenChange(false);
    setTitle('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Add Sub-task</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                    <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Sub-task title"
                    />
                </div>
                <DialogFooter>
                    <Button type="submit">Add Sub-task</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
  );
});

export default AddSubTaskDialog;
