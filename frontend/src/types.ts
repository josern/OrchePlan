export type ProjectRole = 'owner' | 'editor' | 'viewer';


export type Project = {
    id: string;
    name: string;
    description?: string;
    members: Record<string, ProjectRole>;
    parentProjectId?: string;
    subProjects?: Project[];
};

export type Task = {
    id: string;
    title: string;
    description?: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    status: string;
    dueDate?: string;
    projectId: string;
    assigneeId?: string;
    parentTaskId?: string;
};

export type TaskStatusOption = {
    id: string;
    name: string;
    color: string;
    order: number;
    showStrikeThrough?: boolean;
    hidden?: boolean;
    requiresComment?: boolean;
    allowsComment?: boolean;
}

export type User = {
    id: string;
    name: string;
    email: string;
}

export type TaskComment = {
    id: string;
    content: string;
    taskId: string;
    authorId: string;
    author: {
        id: string;
        name: string;
        email: string;
    };
    statusId?: string;
    status?: {
        id: string;
        label: string;
        color: string;
    };
    createdAt: string;
    updatedAt: string;
}
