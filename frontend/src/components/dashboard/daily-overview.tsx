'use client';

import { useMemo, useState } from 'react';
import TaskItem from './task-item';
import { Card, CardContent } from '../ui/card';
import { isPast, isWithinInterval, addHours } from 'date-fns';
import { useApp } from '@/context/app-context';
import { Button } from '../ui/button';
import { Plus } from 'lucide-react';
import AddProjectDialog from './add-project-dialog';
import { DailyOverviewSkeleton } from './daily-overview-skeleton';

export default function DailyOverview() {
  const { projects, tasks: allTasks, currentUser, loading: appContextLoading, deleteTask } = useApp();
  const [isAddProjectDialogOpen, setAddProjectDialogOpen] = useState(false);

  const sortedTasks = useMemo(() => {
    if (!currentUser) return [];
    
    const now = new Date();
    const twentyFourHoursFromNow = addHours(now, 24);

    const relevantTasks = allTasks.filter(t => {
      if (t.parentId) return false;
      if (t.status === 'done' || !t.assigneeId || t.assigneeId !== currentUser.id) {
        return false;
      }
      
      if (!t.dueTime) {
        return true;
      }
      
      const dueDate = new Date(t.dueTime);
      const isOverdue = isPast(dueDate);
      const isDueInNext24Hours = isWithinInterval(dueDate, { start: now, end: twentyFourHoursFromNow });
      
      return isOverdue || isDueInNext24Hours;
    });

    const tasksWithDate = relevantTasks.filter(t => t.dueTime);
    const tasksWithoutDate = relevantTasks.filter(t => !t.dueTime);

    tasksWithDate.sort((a, b) => new Date(a.dueTime!).getTime() - new Date(b.dueTime!).getTime());
    
    tasksWithoutDate.sort((a, b) => a.title.localeCompare(b.title));

    return [...tasksWithDate, ...tasksWithoutDate];
  }, [allTasks, currentUser]);

  if (appContextLoading) {
    return <DailyOverviewSkeleton />;
  }

  if(projects.length === 0 && allTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-lg font-semibold mb-2">Welcome to your new workspace!</p>
        <p className="text-muted-foreground mb-4">Get started by creating your first project.</p>
        <AddProjectDialog open={isAddProjectDialogOpen} onOpenChange={setAddProjectDialogOpen}>
          <Button onClick={() => setAddProjectDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Project
          </Button>
        </AddProjectDialog>
      </div>
    );
  }

  return (
    <div>
        <h2 className="text-2xl font-bold mb-4">Daily Overview</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-3">
                <CardContent className="pt-6">
                    <h3 className="font-semibold mb-3">Your Priority Tasks</h3>
                    <div className="space-y-2">
                        {sortedTasks.length > 0 ? (
                            sortedTasks.map(task => (
                                <TaskItem key={task.id} task={task} onDelete={deleteTask} />
                            ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No tasks to prioritize.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
