export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role?: string; // user, admin, superuser
};

export type TaskStatus = string;

export type TaskStatusOption = {
  id: string;
  name: string;
  color: string;
  order: number;
  showStrikeThrough?: boolean;
  hidden?: boolean;
  requiresComment?: boolean;
  allowsComment?: boolean;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  dueTime?: string;
  status: TaskStatus;
  projectId: string;
  assigneeId?: string;
  parentId?: string;
};

export type TaskComment = {
  id: string;
  content: string;
  taskId: string;
  userId: string;
  statusId?: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  status?: {
    id: string;
    name: string;
    color: string;
  };
};

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export type Project = {
  id:string;
  name: string;
  members: Record<string, ProjectRole>;
  subProjects?: Project[];
  parentProjectId?: string;
  taskStatusOptions?: TaskStatusOption[];
};
