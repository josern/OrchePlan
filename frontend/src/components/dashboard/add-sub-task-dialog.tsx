'use client';

import React, { useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useApp } from '@/context/app-context';
import type { Task } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import statusUtils from '@/lib/status-utils';

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

    // Determine the first (lowest-order) visible status for this project.
  // Prefer the project's first visible status; do NOT fall back to the parent's
  // status to avoid accidental inheritance.
  const firstStatusId: string | undefined = statusUtils.getFirstVisibleStatusId(project as any);

    const newSubTask: Omit<Task, 'id'> = {
      title,
      priority: parentTask.priority || 'normal', // Inherit parent's priority or default to medium
      projectId: parentTask.projectId,
      assigneeId: parentTask.assigneeId,
      parentId: parentTask.id,
  // Default a new sub-task to the first visible status in the project
  // (e.g. 'To-Do'). If the project has no statuses configured, leave the
  // status undefined so the server will choose the project's default.
  status: firstStatusId ?? undefined,
    };

    await addTask(newSubTask);
    // Previously the UI moved the parent back to the first (default) status
    // when creating a sub-task. That caused unexpected parent regressions
    // (parent moved to To-Do) when users created subtasks. We intentionally
    // avoid changing the parent's status here so the parent remains where
    // the user left it.
    
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
