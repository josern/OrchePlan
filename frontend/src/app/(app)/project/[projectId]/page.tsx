'use client';

import { useState, useRef, useMemo, useCallback, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/context/app-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Folder, LayoutGrid, List, Upload, Download, ChevronDown, ChevronsDown, ChevronsUp } from 'lucide-react';
import type { Project, Task, TaskStatusOption } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import KanbanBoard from '@/components/dashboard/kanban-board';
import TaskItem from '@/components/dashboard/task-item';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { exportTasksToCSV, importTasksFromCSV } from '@/lib/csv';
import { bulkImportTasks, type BulkImportResult } from '@/lib/bulk-operations';
import { useToast } from '@/hooks/use-toast';
import { findProjectById } from '@/lib/projects';
import { ComponentErrorBoundary } from '@/components/error-boundary';
import { sortByPriorityThen, comparePriority } from '@/lib/priority-utils';


// Memoized component for sub-projects grid
const SubProjectsGrid = memo<{ subProjects: Project[] }>(function SubProjectsGrid({ subProjects }) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center"><Folder className="mr-2" />Sub-Projects</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {subProjects.map(sub => (
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
  );
});


// Memoized component for grouped task rendering
const GroupedTaskList = memo<{
  listViewTasks: Task[];
  taskStatusOptions: TaskStatusOption[];
  collapsedGroups: Record<string, boolean>;
  onGroupCollapse: (statusId: string, collapsed: boolean) => void;
  onDeleteTask: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  canEdit: boolean;
}>(function GroupedTaskList({ 
  listViewTasks, 
  taskStatusOptions, 
  collapsedGroups, 
  onGroupCollapse, 
  onDeleteTask, 
  onStatusChange, 
  canEdit 
}) {
  const groupedData = useMemo(() => {
    const statusById = new Map<string, TaskStatusOption>(taskStatusOptions.map(s => [s.id, s]));
    const groups = new Map<string, Task[]>();
    const remainingIds = new Set<string>();
    
    listViewTasks.forEach(t => {
      const sid = t.status || 'no-status';
      if (!groups.has(sid)) groups.set(sid, []);
      groups.get(sid)!.push(t);
      remainingIds.add(sid);
    });

    const orderedStatusIds = taskStatusOptions.map(s => s.id);
    
    return { statusById, groups, remainingIds, orderedStatusIds };
  }, [listViewTasks, taskStatusOptions]);

  return (
    <div className="space-y-4">
      {/* Render ordered status groups */}
      {groupedData.orderedStatusIds.map(sid => {
        if (!groupedData.groups.has(sid)) return null;
        groupedData.remainingIds.delete(sid);
        const status = groupedData.statusById.get(sid);
        const items = groupedData.groups.get(sid) || [];
        const isCollapsed = collapsedGroups[sid];
        
        return (
          <StatusGroup
            key={sid}
            statusId={sid}
            statusName={status ? status.name : sid}
            tasks={items}
            isCollapsed={isCollapsed}
            onToggleCollapse={onGroupCollapse}
            onDeleteTask={onDeleteTask}
            onStatusChange={onStatusChange}
            canEdit={canEdit}
          />
        );
      })}

      {/* Render remaining groups (no-status or unknown) */}
      {Array.from(groupedData.remainingIds).map(sid => {
        const items = groupedData.groups.get(sid) || [];
        const isCollapsed = collapsedGroups[sid];
        
        return (
          <StatusGroup
            key={sid}
            statusId={sid}
            statusName={sid === 'no-status' ? 'No status' : sid}
            tasks={items}
            isCollapsed={isCollapsed}
            onToggleCollapse={onGroupCollapse}
            onDeleteTask={onDeleteTask}
            onStatusChange={onStatusChange}
            canEdit={canEdit}
          />
        );
      })}
    </div>
  );
});

// Memoized component for a single status group
const StatusGroup = memo<{
  statusId: string;
  statusName: string;
  tasks: Task[];
  isCollapsed: boolean;
  onToggleCollapse: (statusId: string, collapsed: boolean) => void;
  onDeleteTask: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  canEdit: boolean;
}>(function StatusGroup({ 
  statusId, 
  statusName, 
  tasks, 
  isCollapsed, 
  onToggleCollapse, 
  onDeleteTask, 
  onStatusChange, 
  canEdit 
}) {
  const handleToggle = useCallback(() => {
    onToggleCollapse(statusId, !isCollapsed);
  }, [statusId, isCollapsed, onToggleCollapse]);

  const sanitizedId = useMemo(() => 
    statusId.replace(/[^a-zA-Z0-9_-]/g, '-'), 
    [statusId]
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-3 text-sm font-semibold text-muted-foreground"
          aria-controls={`group-${sanitizedId}`}
          aria-expanded={!isCollapsed}
        >
          <ChevronDown 
            className={`w-4 h-4 transform transition-transform ${
              isCollapsed ? '-rotate-90' : 'rotate-0'
            } text-muted-foreground`} 
            strokeWidth={2} 
          />
          <span>{statusName}</span>
        </button>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div
        id={`group-${sanitizedId}`}
        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out mt-2 ${
          isCollapsed ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ maxHeight: isCollapsed ? 0 : `${tasks.length * 120}px` }}
      >
        <div className="space-y-2">
          {tasks.map(task => (
            <ComponentErrorBoundary key={task.id}>
              <TaskItem
                task={task}
                onDelete={onDeleteTask}
                onStatusChange={(taskId, newStatus) => onStatusChange(taskId, newStatus)}
                canEdit={canEdit}
              />
            </ComponentErrorBoundary>
          ))}
        </div>
      </div>
    </div>
  );
});


export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  if (!params || !params.projectId) {
    return <div>Project not found</div>;
  }
  const { projectId } = params;
  const { 
    projects, tasks, updateTask, updateTaskImmediate, deleteTask, loading, addTask, 
    currentUser, isKanbanHeaderVisible, defaultView, setDefaultView
  , groupByStatus, setGroupByStatus } = useApp();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const project = findProjectById(projects, projectId as string);
  const taskStatusOptions = useMemo(() => project?.taskStatusOptions || [], [project]);

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

  // Local UI state: which status groups are collapsed. Persist per-project in sessionStorage.
  const storageKey = useMemo(() => `collapsed_groups_${projectId}`, [projectId]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    const key = `collapsed_groups_${projectId}`;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });

  const setGroupCollapsed = useCallback((statusId: string, collapsed: boolean) => {
    setCollapsedGroups(prev => {
      const next = { ...prev, [statusId]: collapsed };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch (e) {}
      return next;
    });
  }, [storageKey]);

  const setAllCollapsed = useCallback((collapsed: boolean) => {
    const next: Record<string, boolean> = {};
    taskStatusOptions.forEach(s => { next[s.id] = collapsed; });
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch (e) {}
    setCollapsedGroups(next);
  }, [taskStatusOptions, storageKey]);

  const allCollapsed = useMemo(
    () => taskStatusOptions.length > 0 && taskStatusOptions.every(s => collapsedGroups[s.id]),
    [taskStatusOptions, collapsedGroups]
  );

  const sortedProjectTasks = useMemo(() => {
    const tasksWithDate = projectTasks.filter(t => t.dueTime);
    const tasksWithoutDate = projectTasks.filter(t => !t.dueTime);

    // Sort tasks with due dates: priority first, then by due date
    const sortedTasksWithDate = sortByPriorityThen(tasksWithDate, (a, b) => 
      new Date(a.dueTime!).getTime() - new Date(b.dueTime!).getTime()
    );
    
    // Sort tasks without due dates: priority first, then by title
    const sortedTasksWithoutDate = sortByPriorityThen(tasksWithoutDate, (a, b) => 
      a.title.localeCompare(b.title)
    );

    return [...sortedTasksWithDate, ...sortedTasksWithoutDate];
  }, [projectTasks]);

  const sortedMainTasks = useMemo(() => {
      return sortedProjectTasks.filter(t => !t.parentId); // Already sorted by priority in sortedProjectTasks
  }, [sortedProjectTasks]);

  // For list view we want tasks ordered by their status order (as defined by taskStatusOptions).
  // If statuses are missing or have equal order, fall back to the existing sortedProjectTasks order.
  const listViewTasks = useMemo(() => {
    if (!taskStatusOptions || taskStatusOptions.length === 0) return sortedMainTasks;

    const statusOrder = new Map<string, number>();
    taskStatusOptions.forEach(s => statusOrder.set(s.id, typeof s.order === 'number' ? s.order as number : 0));

    const fallbackIndex = new Map<string, number>();
    sortedProjectTasks.forEach((t, idx) => fallbackIndex.set(t.id, idx));

    const clone = [...sortedMainTasks];
    clone.sort((a, b) => {
      const aOrder = statusOrder.get(a.status as string) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = statusOrder.get(b.status as string) ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      
      // If status order is the same, sort by priority first
      const priorityComparison = comparePriority(a, b);
      if (priorityComparison !== 0) {
        return priorityComparison;
      }
      
      // fallback to previous ordering (due date / title) to keep deterministic order
      const ai = fallbackIndex.get(a.id) ?? 0;
      const bi = fallbackIndex.get(b.id) ?? 0;
      return ai - bi;
    });
    return clone;
  }, [sortedMainTasks, taskStatusOptions, sortedProjectTasks]);

  // All hooks must be called before any conditional returns (Rules of Hooks)
  const handleStatusChange = useCallback((taskId: string, newStatusId: string) => {
    const taskToUpdate = tasks.find(t => t.id === taskId);
    const status = taskStatusOptions.find(s => s.id === newStatusId);
    if (taskToUpdate && status) {
        updateTask({ ...taskToUpdate, status: status.id });
    }
  }, [tasks, taskStatusOptions, updateTask]);

  const handleStatusChangeFast = useCallback((taskId: string, newStatusId: string) => {
    const taskToUpdate = tasks.find(t => t.id === taskId);
    const status = taskStatusOptions.find(s => s.id === newStatusId);
    if (taskToUpdate && status) {
        updateTaskImmediate({ ...taskToUpdate, status: status.id });
    }
  }, [tasks, taskStatusOptions, updateTaskImmediate]);

  const handleDeleteTask = useCallback((taskId: string) => {
    deleteTask(taskId);
  }, [deleteTask]);

  const handleExport = useCallback(() => {
    if (!project) return;
    exportTasksToCSV(projectTasks, project.name, taskStatusOptions);
    toast({
        title: "Export Successful",
        description: "Your tasks have been exported to a CSV file.",
    });
  }, [projectTasks, project, taskStatusOptions, toast]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!project) return;
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const { mainTasks, subtaskGroups, warnings } = await importTasksFromCSV(
        file,
        project.id,
        taskStatusOptions,
        tasks
      );

      let totalImported = 0;
      let allWarnings = [...warnings];

      // Step 1: Bulk import all main tasks
  let mainResult: BulkImportResult = { imported: 0, failed: 0, errors: [], tasks: [], success: true };
      if (mainTasks.length > 0) {
        mainResult = await bulkImportTasks(project.id, mainTasks.map(t => ({
          title: t.title,
          description: t.description,
          priority: t.priority as any,
          dueDate: t.dueTime,
          statusId: t.status,
          assignedTo: t.assigneeId
        })));
        totalImported += mainResult.imported;
        if (mainResult.failed > 0) {
          allWarnings.push(...mainResult.errors.map(e => `Failed to import main task: ${e.title || ''}`));
        }
      }

      // Step 2: Create a map of newly created main task titles to IDs (if needed for subtasks)
      // NOTE: If you want to update UI with new tasks, you may need to refetch or update state here.

      // Step 3: Bulk import subtasks for each group
      for (const group of subtaskGroups) {
        // Find parent ID (prefer existing to avoid conflicts)
        const existingParentId = tasks.find(t =>
          t.title.toLowerCase().trim() === group.parentTitle.toLowerCase().trim() &&
          t.projectId === project.id
        )?.id;

        if (existingParentId) {
          // Bulk import subtasks with parentId
          const subResult = await bulkImportTasks(project.id, group.subtasks.map(t => ({
            title: t.title,
            description: t.description,
            priority: t.priority as any,
            dueDate: t.dueTime,
            statusId: t.status,
            assignedTo: t.assigneeId,
            parentId: existingParentId
          })));
          totalImported += subResult.imported;
          if (subResult.failed > 0) {
            allWarnings.push(...subResult.errors.map(e => `Failed to import subtask: ${e.title || ''}`));
          }
        } else {
          // No parent found, import as main tasks
          const subResult = await bulkImportTasks(project.id, group.subtasks.map(t => ({
            title: t.title,
            description: t.description,
            priority: t.priority as any,
            dueDate: t.dueTime,
            statusId: t.status,
            assignedTo: t.assigneeId
          })));
          totalImported += subResult.imported;
          allWarnings.push(`Could not find parent task '${group.parentTitle}' for ${group.subtasks.length} subtasks. Imported as main tasks.`);
          if (subResult.failed > 0) {
            allWarnings.push(...subResult.errors.map(e => `Failed to import subtask: ${e.title || ''}`));
          }
        }
      }

      // Show results
      if (allWarnings.length > 0) {
        console.warn('Import warnings:', allWarnings);
        toast({
          title: "Import Completed with Warnings",
          description: `${totalImported} tasks imported. ${allWarnings.length} warnings occurred. Check console for details.`,
        });
      } else {
        toast({
          title: "Import Successful",
          description: `${totalImported} tasks have been imported (${mainTasks.length} main tasks, ${subtaskGroups.reduce((sum, g) => sum + g.subtasks.length, 0)} subtasks).`,
        });
      }
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
  }, [project, taskStatusOptions, tasks, toast]);

  // Conditional returns must come after ALL hooks
  if (loading) {
    return <ProjectPageSkeleton />;
  }
  
  if (!project) {
    return <div>Project not found</div>;
  }

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
                  <SubProjectsGrid subProjects={project.subProjects} />
                )}
            </>
        )}

  {/* controlled tabs: initialize from global defaultView and update it when user toggles */}
  <Tabs value={defaultView} onValueChange={(v) => setDefaultView(v as 'board' | 'list')}>
            <div className={`flex justify-end mb-4 ${!isKanbanHeaderVisible ? 'hidden' : ''}`}>
                <div className="flex items-center gap-2">
                    {/* Show group controls only when in List view */}
                    {defaultView === 'list' && (
                      <div className="flex items-center gap-2 mr-2">
                        <span className="text-sm text-muted-foreground">Group by status</span>
                        <Switch checked={groupByStatus} onCheckedChange={(v) => setGroupByStatus(!!v)} />
                        {/* Show expand/collapse only when grouping is enabled */}
                        {groupByStatus && (
                          <>
                            <div className="h-6 w-px bg-border mx-2" />
                            <button
                              type="button"
                              className="text-sm text-muted-foreground hover:text-foreground ml-2 flex items-center gap-2"
                              onClick={() => setAllCollapsed(!allCollapsed)}
                            >
                                  {allCollapsed ? (
                                    <ChevronsDown className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
                                  ) : (
                                    <ChevronsUp className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
                                  )}
                              <span>{allCollapsed ? 'Expand all' : 'Collapse all'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
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
                <ComponentErrorBoundary>
                    <KanbanBoard 
                        tasks={sortedProjectTasks}
                        taskStatusOptions={taskStatusOptions}
                        onStatusChange={handleStatusChangeFast} 
                        onDelete={handleDeleteTask} 
                        isKanbanHeaderVisible={isKanbanHeaderVisible}
                    />
                </ComponentErrorBoundary>
            </TabsContent>
            <TabsContent value="list">
                <ComponentErrorBoundary>
                    <div className="space-y-3">
                      {listViewTasks.length > 0 ? (
                        groupByStatus ? (
                          <GroupedTaskList
                            listViewTasks={listViewTasks}
                            taskStatusOptions={taskStatusOptions}
                            collapsedGroups={collapsedGroups}
                            onGroupCollapse={setGroupCollapsed}
                            onDeleteTask={handleDeleteTask}
                            onStatusChange={handleStatusChange}
                            canEdit={canEdit}
                          />
                        ) : (
                          // flat list
                          listViewTasks.map(task => (
                            <ComponentErrorBoundary key={task.id}>
                              <TaskItem 
                                task={task}
                                onDelete={handleDeleteTask}
                                onStatusChange={(taskId, newStatus) => handleStatusChange(taskId, newStatus)}
                                canEdit={canEdit}
                              />
                            </ComponentErrorBoundary>
                          ))
                        )
                      ) : (
                        <Card>
                          <CardContent className="p-6">
                            <p className="text-muted-foreground">No tasks in this project or its sub-projects yet.</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                </ComponentErrorBoundary>
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
