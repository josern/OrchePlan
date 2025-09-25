'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useApp } from '@/context/app-context';
import type { Task } from '@/lib/types';

interface AddSubTaskDialogProps {
  parentTask: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

export default function AddSubTaskDialog({ parentTask, open, onOpenChange, children }: AddSubTaskDialogProps) {
  const { addTask } = useApp();
  const [title, setTitle] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const newSubTask: Partial<Task> = {
      title,
      projectId: parentTask.projectId,
      assigneeId: parentTask.assigneeId,
      parentId: parentTask.id,
      status: 'todo',
    };

    await addTask(newSubTask);
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
}
