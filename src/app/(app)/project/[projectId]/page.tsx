'use client';

import { useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/context/app-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Folder, LayoutGrid, List, Upload, Download } from 'lucide-react';
import type { Project, Task, TaskStatusOption } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import KanbanBoard from '@/components/dashboard/kanban-board';
import TaskItem from '@/components/dashboard/task-item';
import { Button } from '@/components/ui/button';
import { exportTasksToCSV, importTasksFromCSV } from '@/lib/csv';
import { useToast } from '@/hooks/use-toast';
import { findProjectById } from '@/lib/projects';


export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { projectId } = params;
  const { 
    projects, tasks, updateTask, deleteTask, loading, addTask, 
    taskStatusOptions, currentUser, isKanbanHeaderVisible 
  } = useApp();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const project = findProjectById(projects, projectId as string);

  const canEdit = useMemo(() => {
    if (!project || !currentUser) return false;
    if (!project.members) return false;
    const userRole = project.members[currentUser.id];
    return userRole === 'owner' || userRole === 'editor';
  }, [project, currentUser]);

  const projectTasks = useMemo(() => {
    if (!project) return [];
    const getProjectAndSubProjectIds = (p: Project): string[] => {
        let ids = [p.id];
        if (p.subProjects && p.subProjects.length > 0) {
            ids = ids.concat(...p.subProjects.map(getProjectAndSubProjectIds));
        }
        return ids;
    };
    const allProjectIds = getProjectAndSubProjectIds(project);
    return tasks.filter(task => task.projectId && allProjectIds.includes(task.projectId));
  }, [project, tasks]);

  const sortedProjectTasks = useMemo(() => {
    const tasksWithDate = projectTasks.filter(t => t.dueTime);
    const tasksWithoutDate = projectTasks.filter(t => !t.dueTime);

    tasksWithDate.sort((a, b) => new Date(a.dueTime!).getTime() - new Date(b.dueTime!).getTime());
    tasksWithoutDate.sort((a, b) => a.title.localeCompare(b.title));

    return [...tasksWithDate, ...tasksWithoutDate];
  }, [projectTasks]);

  const sortedMainTasks = useMemo(() => {
      return sortedProjectTasks.filter(t => !t.parentId);
  }, [sortedProjectTasks]);


  if (loading) {
    return <ProjectPageSkeleton />;
  }
  
  if (!project) {
    return <div>Project not found</div>;
  }

  const handleStatusChange = (taskId: string, newStatusId: string) => {
    const taskToUpdate = tasks.find(t => t.id === taskId);
    const status = taskStatusOptions.find(s => s.id === newStatusId);
    if (taskToUpdate && status) {
        updateTask({ ...taskToUpdate, status: status.id });
    }
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask(taskId);
  };

  const handleExport = () => {
    exportTasksToCSV(projectTasks, project.name);
    toast({
        title: "Export Successful",
        description: "Your tasks have been exported to a CSV file.",
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const importedTasks = await importTasksFromCSV(file, project.id, taskStatusOptions);
        await Promise.all(importedTasks.map(task => addTask(task)));
        toast({
            title: "Import Successful",
            description: `${importedTasks.length} tasks have been imported.`,
        });
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Import Failed",
            description: error instanceof Error ? error.message : "An unknown error occurred.",
        });
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  return (
    <div>
        {isKanbanHeaderVisible && (
            <>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <Folder className="w-8 h-8 text-primary" />
                        <h1 className="text-3xl font-bold font-headline">{project.name}</h1>
                    </div>
                </div>

                {project.subProjects && project.subProjects.length > 0 && (
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="flex items-center"><Folder className="mr-2" />Sub-Projects</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {project.subProjects!.map(sub => (
                          <Link key={sub.id} href={`/project/${sub.id}`}>
                            <div className="block p-4 rounded-lg border hover:bg-muted transition-colors">
                              <div className="flex items-center gap-3">
                                <Folder className="w-6 h-6 text-muted-foreground" />
                                <h3 className="font-semibold">{sub.name}</h3>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
            </>
        )}

        <Tabs defaultValue="board">
            <div className={`flex justify-end mb-4 ${!isKanbanHeaderVisible ? 'hidden' : ''}`}>
                <div className="flex items-center gap-2">
                    {canEdit && (
                        <>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden"/>
                            <Button variant="outline" size="sm" onClick={handleImportClick}><Upload className="mr-2 h-4 w-4" /> Import</Button>
                            <Button variant="outline" size="sm" onClick={handleExport} disabled={projectTasks.length === 0}><Download className="mr-2 h-4 w-4" /> Export</Button>
                        </>
                    )}
                    <TabsList>
                        <TabsTrigger value="board"><LayoutGrid className="mr-2 h-4 w-4" /> Board</TabsTrigger>
                        <TabsTrigger value="list"><List className="mr-2 h-4 w-4" /> List</TabsTrigger>
                    </TabsList>
                </div>
            </div>

            <TabsContent value="board">
                <KanbanBoard tasks={sortedProjectTasks} onStatusChange={handleStatusChange} onDelete={handleDeleteTask} />
            </TabsContent>
            <TabsContent value="list">
                <div className="space-y-3">
                    {sortedMainTasks.length > 0 ? (
                    sortedMainTasks.map(task => (
                        <TaskItem 
                            key={task.id} 
                            task={task}
                            onDelete={handleDeleteTask}
                            onStatusChange={(taskId, newStatus) => handleStatusChange(taskId, newStatus)}
                            canEdit={canEdit}
                        />
                    ))
                    ) : (
                    <Card>
                        <CardContent className="p-6">
                        <p className="text-muted-foreground">No tasks in this project or its sub-projects yet.</p>
                        </CardContent>
                    </Card>
                    )}
                </div>
            </TabsContent>
        </Tabs>
    </div>
  );
}


function ProjectPageSkeleton() {
    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="w-8 h-8 rounded-md" />
                    <Skeleton className="h-9 w-48" />
                </div>
                <Skeleton className="h-10 w-40" />
            </div>
            <div className="space-y-3">
                <Skeleton className="h-6 w-1/4 mb-4" />
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/3" />
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                    </CardContent>
                </Card>
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
    )
}
