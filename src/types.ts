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
}

export type User = {
    id:string;
    name: string;
    email: string;
    avatarUrl: string;
}
