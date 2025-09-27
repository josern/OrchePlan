'use client';

import { useMemo, useState } from 'react';
import { Task, TaskStatus, Project, User, TaskStatusOption } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import TaskItem from './task-item';
import { DndContext, closestCenter, DragEndEvent, useDroppable, UniqueIdentifier, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useApp } from '@/context/app-context';

type KanbanBoardProps = {
  tasks: Task[];
  taskStatusOptions: TaskStatusOption[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  isKanbanHeaderVisible?: boolean;
};

type KanbanColumnProps = {
    id: UniqueIdentifier;
    title: string;
    tasks: Task[];
    onDelete: (taskId: string) => void;
    onStatusChange: (taskId: string, status: TaskStatus) => void;
    projects: Project[];
    currentUser: User | null;
    isKanbanHeaderVisible?: boolean;
};

const findProjectById = (projects: Project[], id: string): Project | undefined => {
    for (const project of projects) {
        if (project.id === id) {
            return project;
        }
        if (project.subProjects && project.subProjects.length > 0) {
            const foundInSub = findProjectById(project.subProjects, id);
            if (foundInSub) {
                return foundInSub;
            }
        }
    }
    return undefined;
};

const SortableTaskItem = ({ task, onDelete, onStatusChange, projects, currentUser }: { task: Task; onDelete: (taskId: string) => void; onStatusChange: (taskId: string, status: TaskStatus) => void; projects: Project[], currentUser: User | null }) => {
    const project = useMemo(() => findProjectById(projects, task.projectId), [projects, task.projectId]);
    const userRole = project && currentUser ? project.members[currentUser.id] : undefined;
    const canEdit = userRole === 'owner' || userRole === 'editor';

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id, disabled: !canEdit });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <TaskItem
                task={task}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                canEdit={canEdit}
                showStatusSelector={false}
            />
        </div>
    );
};


const KanbanColumn = ({ id, title, tasks, onDelete, onStatusChange, projects, currentUser, isKanbanHeaderVisible }: KanbanColumnProps) => {
    const { setNodeRef } = useDroppable({ id });

    return (
        <Card className="bg-muted/30 flex flex-col">
            <CardHeader className="p-4">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                    <span className="capitalize">{title}</span>
                    <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded-md">
                        {tasks.length}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent ref={setNodeRef} className="p-2 pt-0 flex-grow">
                <ScrollArea className={isKanbanHeaderVisible === false ? "h-[calc(100vh-12rem)]" : "h-[calc(100vh-19rem)]"}>
                     <SortableContext
                        id={id as string}
                        items={tasks.map(t => t.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-2 p-2">
                            {tasks.length > 0 ? (
                                tasks.map(task => (
                                    <SortableTaskItem
                                        key={task.id}
                                        task={task}
                                        onDelete={onDelete}
                                        onStatusChange={onStatusChange}
                                        projects={projects}
                                        currentUser={currentUser}
                                    />
                                ))
                            ) : (
                                <div className="text-sm text-center text-muted-foreground py-4">
                                    No tasks yet
                                </div>
                            )}
                        </div>
                    </SortableContext>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};


export default function KanbanBoard({ tasks, taskStatusOptions, onStatusChange, onDelete, isKanbanHeaderVisible }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const { projects, currentUser } = useApp();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const columns = useMemo(() => {
    if (!taskStatusOptions) return [];
    const groupedTasks = taskStatusOptions.reduce((acc, status) => {
      acc[status.id] = [];
      return acc;
    }, {} as Record<TaskStatus, Task[]>);

    tasks.forEach(task => {
      if (task.parentId) return;
      const statusId = task.status || (taskStatusOptions.find(s => s.name.toLowerCase() === 'to do')?.id);
      if (statusId && groupedTasks[statusId]) {
        groupedTasks[statusId].push(task);
      }
    });

    return taskStatusOptions.map(status => ({
      id: status.id,
      title: status.name,
      tasks: groupedTasks[status.id] || [],
    }));
  }, [tasks, taskStatusOptions]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    setActiveTask(task || null);
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const activeContainer = active.data.current?.sortable.containerId;
        const overContainer = over.data.current?.sortable.containerId || over.id;

        if (activeContainer !== overContainer) {
            onStatusChange(active.id as string, overContainer as TaskStatus);
        }
    }
  };
  
  const activeTaskCanEdit = useMemo(() => {
    if (!activeTask) return false;
    const project = findProjectById(projects, activeTask.projectId);
    if (!project || !currentUser) return false;
    const userRole = project.members[currentUser.id];
    return userRole === 'owner' || userRole === 'editor';
}, [activeTask, projects, currentUser]);

  return (
    <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
    >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {columns.map(column => (
                <KanbanColumn
                    key={column.id}
                    id={column.id}
                    title={column.title}
                    tasks={column.tasks}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                    projects={projects}
                    currentUser={currentUser}
                    isKanbanHeaderVisible={isKanbanHeaderVisible}
                />
            ))}
        </div>
        <DragOverlay>
            {activeTask ? <TaskItem task={activeTask} onDelete={() => {}} onStatusChange={() => {}} canEdit={activeTaskCanEdit} showStatusSelector={false} /> : null}
        </DragOverlay>
    </DndContext>
  );
}
