'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Task, TaskStatus, Project, User, TaskStatusOption } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import TaskItem from './task-item';
import CommentPromptModal from './comment-prompt-modal';
import { ComponentErrorBoundary } from '@/components/error-boundary';
import { DndContext, closestCenter, DragEndEvent, useDroppable, UniqueIdentifier, DragStartEvent, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useApp } from '@/context/app-context';
import { useModal } from '@/context/modal-context';
import { moveTaskToStatus } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { sortByPriorityThen } from '@/lib/priority-utils';

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

const SortableTaskItem = React.memo<{ 
  task: Task; 
  onDelete: (taskId: string) => void; 
  onStatusChange: (taskId: string, status: TaskStatus) => void; 
  projects: Project[]; 
  currentUser: User | null; 
}>(function SortableTaskItem({ task, onDelete, onStatusChange, projects, currentUser }) {
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
});


const KanbanColumn = React.memo<KanbanColumnProps>(function KanbanColumn({ id, title, tasks, onDelete, onStatusChange, projects, currentUser, isKanbanHeaderVisible }) {
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
                                    <ComponentErrorBoundary key={task.id}>
                                        <SortableTaskItem
                                            task={task}
                                            onDelete={onDelete}
                                            onStatusChange={onStatusChange}
                                            projects={projects}
                                            currentUser={currentUser}
                                        />
                                    </ComponentErrorBoundary>
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
});


export default function KanbanBoard({ tasks, taskStatusOptions, onStatusChange, onDelete, isKanbanHeaderVisible }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    taskId: string;
    newStatusId: string;
    statusName: string;
    taskTitle: string;
    isRequired: boolean;
  } | null>(null);
  const { projects, currentUser } = useApp();
  const { toast } = useToast();
    // modal registry (optional)
    const modal = (() => { try { return useModal(); } catch (e) { return null; } })();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    })
  );

  const columns = useMemo(() => {
    if (!taskStatusOptions) return [];
    
    // Filter out hidden status options from display
    const visibleStatusOptions = taskStatusOptions.filter(status => !status.hidden);
    
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

    // Only show columns for visible (non-hidden) status options
    return visibleStatusOptions.map(status => ({
      id: status.id,
      title: status.name,
      tasks: sortByPriorityThen(groupedTasks[status.id] || [], (a, b) => a.title.localeCompare(b.title)),
    }));
  }, [tasks, taskStatusOptions]);

  const getGridClass = useMemo(() => {
    const visibleColumnCount = columns.length;
    if (visibleColumnCount === 0) return 'grid-cols-1';
    if (visibleColumnCount === 1) return 'grid-cols-1';
    if (visibleColumnCount === 2) return 'grid-cols-1 md:grid-cols-2';
    if (visibleColumnCount === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    if (visibleColumnCount >= 4) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
  }, [columns.length]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    setActiveTask(task || null);
  }, [tasks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const activeContainer = active.data.current?.sortable.containerId;
        const overContainer = over.data.current?.sortable.containerId || over.id;

        if (activeContainer !== overContainer) {
            const taskId = active.id as string;
            const newStatusId = overContainer as string;
            
            // Find the target status and task
            const targetStatus = taskStatusOptions.find(s => s.id === newStatusId);
            const task = tasks.find(t => t.id === taskId);
            
            if (targetStatus && task) {
                // Business Rule 1: Check if parent task can move to target status
                // Parent tasks cannot move to a status with higher order than any of their sub-tasks
                const isSubTask = !!task.parentId;
                if (!isSubTask) {
                    const subTasks = tasks.filter(t => t.parentId === task.id);
                    if (subTasks.length > 0) {
                        const targetOrder = targetStatus.order;
                        const hasSubTaskWithLowerOrder = subTasks.some(subTask => {
                            const subTaskStatus = taskStatusOptions.find(s => s.id === subTask.status);
                            return subTaskStatus && subTaskStatus.order < targetOrder;
                        });
                        
                        if (hasSubTaskWithLowerOrder) {
                            // Show error message and prevent the move
                            toast({
                                variant: "destructive",
                                title: "Cannot move task",
                                description: "Parent tasks cannot be moved to a status higher than their sub-tasks. Please complete sub-tasks first.",
                            });
                            return;
                        }
                    }
                }
                
                // Check comment requirements: Required OR Optional (but not Disabled)
                const shouldShowModal = targetStatus.requiresComment || 
                                      (targetStatus.allowsComment && !targetStatus.requiresComment);
                
                if (shouldShowModal) {
                    // Show comment modal
                    setPendingMove({
                        taskId,
                        newStatusId,
                        statusName: targetStatus.name,
                        taskTitle: task.title,
                        isRequired: !!targetStatus.requiresComment
                    });
                    try { console.debug('[KanbanBoard] shouldShowModal for drag move, targetStatus=', targetStatus, 'task=', taskId); } catch (e) {}
                    if (modal) {
                        try { console.debug('[KanbanBoard] using modal registry to show CommentPromptModal'); } catch (e) {}
                        modal.closeAll();
                        // Capture the taskId/newStatusId into the onConfirm handler directly to avoid
                        // relying on pendingMove state which may not be applied synchronously.
                        const capturedTaskId = taskId;
                        const capturedNewStatusId = newStatusId;
                        modal.showModal(
                          <CommentPromptModal
                            isOpen={true}
                            onClose={() => { /* closed by modalId when available */ }}
                            onConfirm={async (comment: string) => {
                              try {
                                try { console.debug('[KanbanBoard] modal onConfirm inline called for move', capturedTaskId, capturedNewStatusId, comment); } catch(e){}
                                await moveTaskToStatus(capturedTaskId, capturedNewStatusId, comment || undefined);
                                // Notify parent/UI of the change
                                onStatusChange(capturedTaskId, capturedNewStatusId as TaskStatus);
                              } catch (error) {
                                console.error('Failed to move task with comment (inline handler):', error);
                                // Fallback to still update UI so it doesn't look stale
                                onStatusChange(capturedTaskId, capturedNewStatusId as TaskStatus);
                              } finally {
                                setCommentModalOpen(false);
                                setPendingMove(null);
                              }
                            }}
                            statusName={targetStatus.name}
                            taskTitle={task.title}
                            isRequired={!!targetStatus.requiresComment}
                          />
                        );
                    } else {
                        try { console.debug('[KanbanBoard] modal registry not available, using fallback setCommentModalOpen'); } catch (e) {}
                        setCommentModalOpen(true);
                    }
                } else {
                    // Move directly without comment (disabled or default)
                    onStatusChange(taskId, newStatusId as TaskStatus);
                }
            } else {
                // Fallback to direct move if status not found
                onStatusChange(taskId, newStatusId as TaskStatus);
            }
        }
    }
  }, [tasks, taskStatusOptions, onStatusChange]);

  const handleCommentConfirm = useCallback(async (comment: string) => {
    try { console.debug('[KanbanBoard] handleCommentConfirm called, comment=', comment, 'pendingMove=', pendingMove); } catch (e) {}
    if (pendingMove) {
        try {
            // Use the new API endpoint that handles comment requirements
            await moveTaskToStatus(pendingMove.taskId, pendingMove.newStatusId, comment || undefined);
            // Refresh the task list by calling the original status change handler
            onStatusChange(pendingMove.taskId, pendingMove.newStatusId as TaskStatus);
        } catch (error) {
            console.error('Failed to move task with comment:', error);
            // Still try the fallback
            onStatusChange(pendingMove.taskId, pendingMove.newStatusId as TaskStatus);
        }
    }
    setCommentModalOpen(false);
    setPendingMove(null);
  }, [pendingMove, onStatusChange]);

  const handleCommentCancel = useCallback(() => {
    setCommentModalOpen(false);
    setPendingMove(null);
  }, []);
  
  const activeTaskCanEdit = useMemo(() => {
    if (!activeTask) return false;
    const project = findProjectById(projects, activeTask.projectId);
    if (!project || !currentUser) return false;
    const userRole = project.members[currentUser.id];
    return userRole === 'owner' || userRole === 'editor';
}, [activeTask, projects, currentUser]);

  return (
    <>
    <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
    >
        <div className={`grid ${getGridClass} gap-4 items-start`}>
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
    
    {/* Comment Prompt Modal */}
    {pendingMove && (
      <CommentPromptModal
        isOpen={commentModalOpen}
        onClose={handleCommentCancel}
        onConfirm={handleCommentConfirm}
        statusName={pendingMove.statusName}
        taskTitle={pendingMove.taskTitle}
        isRequired={pendingMove.isRequired}
      />
    )}
  </>
  );
}
