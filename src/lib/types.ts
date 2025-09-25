export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
};

export type TaskStatus = string;

export type TaskStatusOption = {
  id: string;
  name: string;
  color: string;
  order: number;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  dueTime?: string;
  status: TaskStatus;
  projectId: string;
  assigneeId?: string;
  parentId?: string;
};

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export type Project = {
  id:string;
  name: string;
  members: Record<string, ProjectRole>;
  subProjects?: Project[];
  parentProjectId?: string;
};
