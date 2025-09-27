'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TaskStatusOption } from '@/lib/types';
import { TwitterPicker } from 'react-color';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ProjectManageStatusesProps {
    projectId: string;
    statuses: TaskStatusOption[];
}

interface SortableItemProps {
    id: string;
    children: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {children}
        </div>
    );
}

export default function ProjectManageStatuses({ projectId, statuses: initialStatuses }: ProjectManageStatusesProps) {
    const { 
        addProjectTaskStatus, 
        updateProjectTaskStatus, 
        deleteProjectTaskStatus, 
        updateProjectTaskStatusOrder,
        addDefaultTaskStatuses
    } = useApp();
    
    const [statuses, setStatuses] = useState<TaskStatusOption[]>(initialStatuses);
    const [newStatusName, setNewStatusName] = useState('');
    const [newStatusColor, setNewStatusColor] = useState('#3B82F6');
    const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
    const [editingStatusName, setEditingStatusName] = useState('');
    const [editingStatusColor, setEditingStatusColor] = useState('');

    useEffect(() => {
        setStatuses(initialStatuses);
    }, [initialStatuses]);

    const handleAddStatus = async () => {
        if (newStatusName.trim() === '') return;
        await addProjectTaskStatus(projectId, { name: newStatusName, color: newStatusColor, order: statuses.length });
        setNewStatusName('');
        setNewStatusColor('#3B82F6');
    };

    const handleUpdateStatus = async (statusId: string) => {
        if (editingStatusName.trim() === '') return;
        await updateProjectTaskStatus(projectId, statusId, { name: editingStatusName, color: editingStatusColor });
        setEditingStatusId(null);
    };

    const handleDeleteStatus = async (statusId: string) => {
        await deleteProjectTaskStatus(projectId, statusId);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = statuses.findIndex(s => s.id === active.id);
            const newIndex = statuses.findIndex(s => s.id === over.id);
            const newStatuses = [...statuses];
            const [removed] = newStatuses.splice(oldIndex, 1);
            newStatuses.splice(newIndex, 0, removed);
            setStatuses(newStatuses);
            await updateProjectTaskStatusOrder(projectId, newStatuses);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Manage Task Statuses</CardTitle>
                <CardDescription>Customize the task statuses for this project.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {statuses.length === 0 && (
                    <div className="text-center text-muted-foreground">
                        <p>No task statuses defined for this project.</p>
                        <Button onClick={() => addDefaultTaskStatuses(projectId)} className="mt-4">Add Default Statuses</Button>
                    </div>
                )}
                <DndContext onDragEnd={handleDragEnd}>
                    <SortableContext items={statuses.map(s => s.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                            {statuses.map(status => (
                                <SortableItem key={status.id} id={status.id}>
                                    <div className="flex items-center space-x-2 p-2 rounded-md bg-muted">
                                        {editingStatusId === status.id ? (
                                            <div className="flex-grow flex items-center space-x-2">
                                                <Input 
                                                    value={editingStatusName}
                                                    onChange={(e) => setEditingStatusName(e.target.value)} 
                                                    className="h-8"
                                                />
                                                <TwitterPicker 
                                                    color={editingStatusColor} 
                                                    onChangeComplete={(color) => setEditingStatusColor(color.hex)} 
                                                />
                                                <Button onClick={() => handleUpdateStatus(status.id)} size="sm">Save</Button>
                                                <Button onClick={() => setEditingStatusId(null)} size="sm" variant="ghost">Cancel</Button>
                                            </div>
                                        ) : (
                                            <div className="flex-grow flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: status.color }}></div>
                                                    <span>{status.name}</span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Button onClick={() => {
                                                        setEditingStatusId(status.id);
                                                        setEditingStatusName(status.name);
                                                        setEditingStatusColor(status.color);
                                                    }} size="sm" variant="outline">Edit</Button>
                                                    <Button onClick={() => handleDeleteStatus(status.id)} size="sm" variant="destructive">Delete</Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </SortableItem>
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
                <div className="flex items-center space-x-2 pt-4">
                    <Input 
                        placeholder="New status name" 
                        value={newStatusName}
                        onChange={(e) => setNewStatusName(e.target.value)} 
                        className="h-8"
                    />
                    <TwitterPicker 
                        color={newStatusColor} 
                        onChangeComplete={(color) => setNewStatusColor(color.hex)} 
                    />
                    <Button onClick={handleAddStatus} size="sm">Add Status</Button>
                </div>
            </CardContent>
        </Card>
    );
}