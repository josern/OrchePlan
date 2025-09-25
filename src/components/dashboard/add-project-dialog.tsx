'use client';

import { useState } from 'react';
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
import { useApp } from '@/context/app-context';

const projectFormSchema = z.object({
  name: z.string().min(3, 'Project name must be at least 3 characters.'),
});

type AddProjectDialogProps = {
    children?: React.ReactNode;
    parentProjectId?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};

export default function AddProjectDialog({ children, parentProjectId, open: controlledOpen, onOpenChange: setControlledOpen }: AddProjectDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { addProject, currentUser } = useApp();

  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;

  const form = useForm<z.infer<typeof projectFormSchema>>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
    },
  });

  async function onSubmit(values: z.infer<typeof projectFormSchema>) {
    if (!currentUser) return;
    
    await addProject({
      name: values.name,
      members: {
        [currentUser.id]: 'owner',
      },
      parentProjectId: parentProjectId
    });
    
    setOpen(false);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{parentProjectId ? 'Create New Sub-project' : 'Create New Project'}</DialogTitle>
          <DialogDescription>
            Fill in the details for your new project.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Q4 Marketing Campaign" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Create Project</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
