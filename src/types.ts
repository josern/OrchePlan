export type Project = {
    id: string;
    name: string;
    description: string;
    subProjects?: Project[];
    parentId?: string | null;
}; 

export type Task = {
    id: string;
    title: string;
    status: string;
    dueTime: string;
    projectId: string;
    assigneeId: string;
    parentId?: string | null;
};

export type TaskStatus = {
    id: string;
    name: string;
    color: string;
}

export type User = {
    id: string;
    name: string;
    email: string;
    avatar: string;
}