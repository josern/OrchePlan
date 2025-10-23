 'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { createProject, updateProjectApi, deleteProjectApi, createTaskApi, updateTaskApi, deleteTaskApi, getProject as apiGetProject, getProjects, getUsers, getTasksByProjectIds, authLogin, authSignup, authLogout, authMe, authChangePassword, getProjectStatuses, createProjectStatus, updateProjectStatus, deleteProjectStatus, updateProjectStatusesOrder, updateUserApi, addProjectMember, updateProjectMemberRole, removeProjectMember } from '@/lib/api';
import { User, Project, Task, TaskStatusOption, ProjectRole } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import RealtimeClient from '../lib/realtime';
import { createComponentLogger } from '@/lib/logger';
import { 
  getCachedProjects, 
  getCachedUsers, 
  getCachedTasksByProjectIds,
  invalidateProjectCaches,
  invalidateTaskCaches,
  invalidateAllProjectCaches,
  optimisticUpdateTask,
  optimisticUpdateProject,
  clearAllCaches,
  prefetchProjectData,
  getCacheStats,
} from '@/lib/cached-api';

interface AppContextType {
  users: Map<string, User>;
  projects: Project[];
  tasks: Task[];
  currentUser: User | null;
  loading: boolean;
  isKanbanHeaderVisible: boolean;
  isSidebarOpenByDefault: boolean;
    cardDensity: 'comfortable' | 'compact';
    setCardDensity: (d: 'comfortable' | 'compact') => void;
  toggleSidebarDefault: () => void;
  toggleKanbanHeader: () => void;
    defaultView: 'board' | 'list';
    setDefaultView: (v: 'board' | 'list') => void;
    groupByStatus: boolean;
    setGroupByStatus: (v: boolean) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  addProject: (project: Omit<Project, 'id' | 'subProjects'>) => Promise<void>;
  updateProject: (projectId: string, projectData: Partial<Omit<Project, 'id' | 'subProjects'>>) => Promise<void>;
  deleteProject: (projectId: string, pathname: string) => Promise<void>;
  getProject: (projectId: string) => Promise<Project | null>;
  duplicateProject: (projectId: string) => Promise<void>;
  addProjectMember: (projectId: string, userId: string, role: string) => Promise<void>;
  updateProjectMemberRole: (projectId: string, userId: string, role: string) => Promise<void>;
  removeProjectMember: (projectId: string, userId: string) => Promise<void>;
  addTask: (task: Omit<Task, 'id'>) => Promise<Task>;
  updateTask: (updatedTask: Task) => Promise<void>;
  updateTaskImmediate: (updatedTask: Task) => void;
  deleteTask: (taskId: string) => Promise<void>;
  updateUser: (userId: string, userData: Partial<Pick<User, 'name' | 'email' | 'avatarUrl'>>) => Promise<void>;
  createUser: (user: Omit<User, 'id'>, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  findUserByEmail: (email: string) => Promise<User | null>;
  findUserByEmailOrName: (query: string) => Promise<User | null>;
  addProjectTaskStatus: (projectId: string, status: Omit<TaskStatusOption, 'id'>) => Promise<void>;
  updateProjectTaskStatus: (projectId: string, statusId: string, statusData: Partial<Omit<TaskStatusOption, 'id'>>) => Promise<void>;
  deleteProjectTaskStatus: (projectId: string, statusId: string) => Promise<void>;
  updateProjectTaskStatusOrder: (projectId: string, statuses: TaskStatusOption[]) => Promise<void>;
  addDefaultTaskStatuses: (projectId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const logger = createComponentLogger('AppContext');

export function AppProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isKanbanHeaderVisible, setIsKanbanHeaderVisible] = useState(true);
  const [isSidebarOpenByDefault, setIsSidebarOpenByDefault] = useState(true);
    const [cardDensity, setCardDensityState] = useState<'comfortable' | 'compact'>('comfortable');
    const [defaultView, setDefaultViewState] = useState<'board' | 'list'>('board');
        const [groupByStatus, setGroupByStatusState] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();
    // derive active project id from pathname when on a project page
    const activeProjectId = useMemo(() => {
        try {
            // match /project/<id> or /project/<id>/...
            const m = pathname?.match(/\/project\/([^\/]+)/);
            return m ? m[1] : null;
        } catch (e) {
            return null;
        }
    }, [pathname]);

  // Debounced task updates for drag operations
  const pendingTaskUpdates = useRef<Map<string, Task>>(new Map());
  const updateTaskTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Realtime client for SSE updates
  const realtimeClient = useRef<RealtimeClient | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
    const prevActiveProjectRef = useRef<string | null>(null);

    // normalize a single project object from backend into frontend shape
    const normalizeProject = (p: any) => {
        if (!p) return p;
        const taskStatusOptions: any[] = Array.isArray(p.statuses)
            ? p.statuses.map((s: any) => {
                const label = (s.label || '').toString();
                // fallback color map when DB doesn't have a color
                const fallback = (() => {
                    const key = label.trim().toLowerCase();
                    if (key === 'to-do' || key === 'todo' || key === 'to do') return '#3B82F6';
                    if (key === 'in progress' || key === 'in-progress') return '#EAB308';
                    if (key === 'done') return '#22C55E';
                    if (key === 'remove' || key === 'removed' || key === 'archive') return '#EF4444';
                    return '#E5E7EB';
                })();
                return { 
                    id: s.id, 
                    name: s.label, 
                    color: s.color || fallback, 
                    order: s.order, 
                    showStrikeThrough: s.showStrikeThrough || false, 
                    hidden: s.hidden || false,
                    requiresComment: s.requiresComment || false,
                    allowsComment: s.allowsComment || false
                };
            })
            : [];

        // normalize members array -> map if needed
        if (Array.isArray(p.members)) {
            const map: Record<string, any> = {};
            p.members.forEach((m: any) => {
                if (m && m.userId && m.role) map[m.userId] = m.role;
            });
            return { ...p, members: map, taskStatusOptions } as any;
        }

        return { ...p, members: p.members || {}, taskStatusOptions } as any;
    };

  useEffect(() => {
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('sidebar_default_open='))
      ?.split('=')[1];
    if (cookieValue) {
      setIsSidebarOpenByDefault(cookieValue === 'true');
    }
  }, []);

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem('card_density');
            if (stored === 'compact' || stored === 'comfortable') setCardDensityState(stored as 'comfortable' | 'compact');
                const dv = window.localStorage.getItem('default_view');
                if (dv === 'board' || dv === 'list') setDefaultViewState(dv as 'board' | 'list');
                    const gb = window.localStorage.getItem('group_by_status');
                    if (gb === 'true' || gb === 'false') setGroupByStatusState(gb === 'true');
        } catch (e) {
            // ignore
        }
    }, []);

  const toggleSidebarDefault = () => {
    setIsSidebarOpenByDefault(prevState => {
      const newState = !prevState;
      document.cookie = `sidebar_default_open=${newState};path=/;max-age=31536000`; // Expires in 1 year
      return newState;
    });
  };

    const setCardDensity = (d: 'comfortable' | 'compact') => {
        setCardDensityState(d);
        try {
            window.localStorage.setItem('card_density', d);
        } catch (e) {
            // ignore
        }
    };

        const setDefaultView = (v: 'board' | 'list') => {
            setDefaultViewState(v);
            try {
                window.localStorage.setItem('default_view', v);
            } catch (e) {
                // ignore
            }
        };

        const setGroupByStatus = (v: boolean) => {
            setGroupByStatusState(v);
            try {
                window.localStorage.setItem('group_by_status', v ? 'true' : 'false');
            } catch (e) {
                // ignore
            }
        };

        // apply global body class for consumption by other components/styles
        useEffect(() => {
            try {
                if (cardDensity === 'compact') {
                    document.body.classList.add('compact');
                } else {
                    document.body.classList.remove('compact');
                }
            } catch (e) {
                // ignore
            }
        }, [cardDensity]);

  const toggleKanbanHeader = () => {
    setIsKanbanHeaderVisible(prevState => !prevState);
  };

  const clearState = () => {
    setUsers(new Map());
    setProjects([]);
    setTasks([]);
    setCurrentUser(null);
  }

  // Clear all authentication data including cookies
  const clearAllAuthData = () => {
    clearState();
    // Clear authentication cookie
    document.cookie = 'orcheplan_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    // Clear any cached data
    clearAllCaches();
  }

    const fetchData = useCallback(async (currentUserId: string) => {
        setLoading(true);
        try {
            // Use cached API calls with stale-while-revalidate strategy
            const projectsResp = await getCachedProjects({ staleWhileRevalidate: true });
            const allProjectsFlat = (projectsResp || []) as Project[];

            // Build nested structure
            const projectMap = new Map<string, Project & { subProjects: Project[] }>();
            allProjectsFlat.forEach(p => projectMap.set(p.id, { ...(normalizeProject(p) as any), subProjects: [] }));

            const nestedProjects: Project[] = [];
            projectMap.forEach(project => {
                if (project.parentProjectId) {
                    const parent = projectMap.get(project.parentProjectId);
                    if (parent) parent.subProjects.push(project);
                    else nestedProjects.push(project);
                } else {
                    nestedProjects.push(project);
                }
            });

            setProjects(nestedProjects);

            // Fetch users with caching
            const usersResp = await getCachedUsers({ staleWhileRevalidate: true });
            const userList = (usersResp || []) as User[];
            const userMap = new Map<string, User>();
            userList.forEach(u => userMap.set(u.id, u));
            setUsers(userMap);

            // Log cache performance
            const stats = getCacheStats();
            logger.debug('Cache performance', { 
                component: 'fetchData',
                stats: {
                    hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
                    hits: stats.hits,
                    misses: stats.misses,
                    size: stats.size
                }
            });

        } catch (error: any) {
            console.error('Error fetching data:', error);
            
            // If we get authentication errors, the stored auth might be stale
            if (error?.status === 401 || error?.status === 404) {
                console.warn('Authentication appears stale, clearing all authentication data');
                clearAllAuthData();
                router?.push('/login');
            }
            // If we get forbidden errors, it might be due to stale cached project data
            else if (error?.status === 403) {
                console.warn('Access forbidden, clearing cached data');
                clearAllCaches();
                // Don't re-fetch automatically to avoid infinite loops
            }
        } finally {
            setLoading(false);
        }
    }, []);

    // Refresh projects without changing loading state
    const refreshProjects = useCallback(async () => {
        try {
            // Force refresh to bypass cache
            const projectsResp = await getCachedProjects({ forceRefresh: true });
            const allProjectsFlat = (projectsResp || []) as Project[];

            const projectMap = new Map<string, Project & { subProjects: Project[] }>();
            allProjectsFlat.forEach(p => projectMap.set(p.id, { ...(normalizeProject(p) as any), subProjects: [] }));

            const nestedProjects: Project[] = [];
            projectMap.forEach(project => {
                if (project.parentProjectId) {
                    const parent = projectMap.get(project.parentProjectId);
                    if (parent) parent.subProjects.push(project);
                    else nestedProjects.push(project);
                } else {
                    nestedProjects.push(project);
                }
            });

            setProjects(nestedProjects);
        } catch (error) {
            console.error('Error refreshing projects:', error);
        }
    }, []);

    // Expose cache clearing function globally for debugging
    useEffect(() => {
        (window as any).clearOrchePlanCache = () => {
            clearAllCaches();
            if (currentUser?.id) {
                fetchData(currentUser.id);
            }
        };
        return () => {
            delete (window as any).clearOrchePlanCache;
        };
    }, [currentUser, fetchData]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                const resp = await authMe();
                const user = resp?.user as User | undefined;
                if (mounted && user) {
                    setCurrentUser(user);
                    await fetchData(user.id);
                } else if (mounted) {
                    // No user logged in (resp is null) - this is normal, not an error
                    clearState();
                }
            } catch (err) {
                console.warn('Error checking authentication', err);
                clearState();
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => { mounted = false };
    }, [fetchData]);

  useEffect(() => {
    if (loading) return;

    if (!currentUser && pathname !== '/login' && pathname !== '/signup') {
      router.push('/login');
    }
  }, [currentUser, loading, pathname, router]);

  useEffect(() => {
    // Only monitor tasks for the active project to reduce load.
    // If we're not on a project page (for example /admin or /settings), do nothing.
    if (!currentUser || !activeProjectId) {
        setTasks([]);
        // Also disconnect realtime client and stop any polling if present
        if (realtimeClient.current) {
            realtimeClient.current.disconnect();
        }
        return;
    }

    // We're only interested in a single activeProjectId
    const allProjectIds = [activeProjectId];

    const CHUNK_SIZE = 100; // Not used for single project but keep shape consistent
    const projectChunks: string[][] = [[activeProjectId]];

    // Normalize task data
    const normalizeTask = (t: any) => ({
        ...t,
        status: t.statusId ?? (typeof t.status === 'string' && /^[0-9a-fA-F-]{36}$/.test(t.status) ? t.status : null),
        assigneeId: t.assigneeId ?? undefined,
        parentId: t.parentId ?? undefined,
    });

    // Task fetching function for both initial load and fallback polling
    const fetchTasks = async (forceRefresh = false) => {
        try {
            const results = await Promise.all(
                projectChunks.map(chunk => 
                    getCachedTasksByProjectIds(chunk, { 
                        forceRefresh,
                        staleWhileRevalidate: !forceRefresh 
                    })
                )
            );
            const combined: any[] = results.flat();
            const normalizedTasks = combined.map(normalizeTask);
            setTasks(normalizedTasks);
            return normalizedTasks;
        } catch (err: any) {
            console.error('Error fetching tasks:', err);
            console.error('[DEBUG] Failed to fetch tasks for project IDs:', allProjectIds);
            
            // If we get a 403 error, it's likely due to requesting tasks for projects
            // the user no longer has access to. Clear caches but don't retry automatically.
            if (err?.status === 403) {
                console.warn('Forbidden error fetching tasks, clearing caches');
                clearAllCaches();
                // Don't retry automatically to avoid infinite loops
            }
            return [];
        }
    };

    // Initial task fetch
    fetchTasks();

    // Polling fallback variables
    let pollingInterval: NodeJS.Timeout | null = null;
    let lastTaskCount = 0;
    let consecutiveNoChanges = 0;
    let isWindowActive = true;
    
    // Smart polling intervals for fallback
    const getPollingInterval = () => {
        if (!isWindowActive) return 60000; // 1 minute when tab is not active
        if (consecutiveNoChanges > 3) return 30000; // 30 seconds after no changes
        return 15000; // 15 seconds for fallback polling (faster than before)
    };

    const startPolling = () => {
        if (pollingInterval) clearInterval(pollingInterval);
        
        const poll = async () => {
            const tasks = await fetchTasks();
            
            // Track changes to adjust polling frequency
            if (tasks.length === lastTaskCount) {
                consecutiveNoChanges++;
            } else {
                consecutiveNoChanges = 0;
                lastTaskCount = tasks.length;
            }
            
            // Restart with potentially new interval
            startPolling();
        };
        
        pollingInterval = setInterval(poll, getPollingInterval());
    };

    // Window focus/blur detection for smart polling
    const handleFocus = () => {
        isWindowActive = true;
        consecutiveNoChanges = 0; // Reset when user returns
    };
    
    const handleBlur = () => {
        isWindowActive = false;
    };

    // Try to initialize SSE connection for real-time updates with improved implementation
    if (!realtimeClient.current) {
        // Use the same API base as the rest of the app for consistency
        const getApiBase = () => {
            // Use environment variable if set
            if (process.env.NEXT_PUBLIC_BACKEND_URL) {
                return process.env.NEXT_PUBLIC_BACKEND_URL;
            }
            if (process.env.NEXT_PUBLIC_API_BASE) {
                return process.env.NEXT_PUBLIC_API_BASE;
            }
            
            if (typeof window === 'undefined') return 'http://localhost:3000';
            
            const hostname = window.location.hostname;
            const protocol = window.location.protocol;
            
            // Local development
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return 'http://localhost:3000';
            }
            
            // External server - construct backend URL
            // In Coder environment, use HTTPS for backend as well
            const isCoderEnv = hostname.includes('coder.josern.com');
            const backendProtocol = isCoderEnv ? 'https:' : protocol;
            
            if (isCoderEnv) {
                // Special handling for Coder subdomain pattern
                const backendHostname = hostname.replace(/^9002--/, '3000--');
                return `${backendProtocol}//${backendHostname}`;
            }
            
            return `${backendProtocol}//${hostname}:3000`;
        };

        const baseUrl = getApiBase();

    realtimeClient.current = new RealtimeClient(baseUrl);

        // Enable production debugging
        realtimeClient.current.enableProductionDebug();

        // Handle authentication failures
        realtimeClient.current.on('auth_failed', (data: any) => {
            console.error('SSE authentication failed - user may need to re-login');
            // Could trigger a re-authentication flow here if needed
        });

        // When client is connected, ensure we subscribe to the active project
        realtimeClient.current.on('connected', (data: any) => {
            try {
                if (activeProjectId) {
                    realtimeClient.current?.subscribe(activeProjectId);
                }
            } catch (e) {
                console.warn('Failed to subscribe to active project on connect', e);
            }
        });

        // Set up event listeners for real-time updates
        realtimeClient.current.on('task_update', (data: any) => {
            const { action, data: taskData } = data;
            const normalizedTask = normalizeTask(taskData);

            // Only process task updates for the active project to avoid unnecessary work
            if (!activeProjectId || normalizedTask.projectId !== activeProjectId) return;

            setTasks(prev => {
                switch (action) {
                    case 'created':
                        // Add new task if not already present (check by ID)
                        const existingTask = prev.find(t => t.id === normalizedTask.id);
                        if (!existingTask) {
                            return [...prev, normalizedTask];
                        } else {
                            return prev;
                        }
                    case 'updated':
                        // Update existing task
                        return prev.map(t => t.id === normalizedTask.id ? normalizedTask : t);
                    case 'deleted':
                        // Remove deleted task
                        return prev.filter(t => t.id !== normalizedTask.id);
                    default:
                        return prev;
                }
            });
        });

        realtimeClient.current.on('project_update', (data: any) => {
            // Only refresh project lists when the active project may be affected
            const projId = data?.data?.id || data?.projectId || data?.id;
            if (!projId) return;
            if (projId === activeProjectId) refreshProjects();
        });

        realtimeClient.current.on('status_update', (data: any) => {
            // Handle status updates - could update project status options
        });

        // Handle SSE connection failure - fall back to polling
        realtimeClient.current.on('connection_failed', (data: any) => {
            setIsRealtimeConnected(false);
            
            // Set up window focus/blur listeners for smart polling
            window.addEventListener('focus', handleFocus);
            window.addEventListener('blur', handleBlur);
            
            // Start polling as fallback
            startPolling();
        });
    }

    // Try to connect to real-time updates
    realtimeClient.current.connect();
    
    // Set a timeout to fall back to polling if SSE doesn't connect within 10 seconds
    setTimeout(() => {
        if (!realtimeClient.current?.getConnectionStatus()) {
            setIsRealtimeConnected(false);
            window.addEventListener('focus', handleFocus);
            window.addEventListener('blur', handleBlur);
            startPolling();
        } else {
            setIsRealtimeConnected(true);
        }
    }, 10000);

    return () => {
        // Clean up on unmount or dependency change
        if (realtimeClient.current) {
            realtimeClient.current.disconnect();
        }
        
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }
        
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
        setIsRealtimeConnected(false);
    };
}, [currentUser, activeProjectId]);

    // Manage subscriptions to project-scoped SSE channels when active project changes
    useEffect(() => {
        if (!realtimeClient.current) return;

        const prev = prevActiveProjectRef.current;

        // If leaving a project view, unsubscribe
        if (!activeProjectId && prev) {
            try {
                realtimeClient.current.unsubscribe(prev);
            } catch (e) {
                console.warn('Failed to unsubscribe from previous project', e);
            }
            prevActiveProjectRef.current = null;
            return;
        }

        // If switched projects, unsubscribe previous and subscribe new
        if (activeProjectId && prev !== activeProjectId) {
            if (prev) {
                try { realtimeClient.current.unsubscribe(prev); } catch (e) { /* ignore */ }
            }
            try {
                realtimeClient.current.subscribe(activeProjectId);
                prevActiveProjectRef.current = activeProjectId;
            } catch (e) {
                console.warn('Failed to subscribe to active project', e);
            }
        }
    }, [activeProjectId]);

    const addDefaultTaskStatuses = async (projectId: string) => {
        if (!currentUser) throw new Error('User not authenticated');
        try {
            const defaultStatuses = [
                { name: 'To Do', color: '#3B82F6', order: 0, showStrikeThrough: false, hidden: false, requiresComment: false, allowsComment: false },
                { name: 'In Progress', color: '#EAB308', order: 1, showStrikeThrough: false, hidden: false, requiresComment: false, allowsComment: true },
                { name: 'Done', color: '#22C55E', order: 3, showStrikeThrough: true, hidden: false, requiresComment: false, allowsComment: false },
                { name: 'Remove', color: '#EF4444', order: 2, showStrikeThrough: false, hidden: false, requiresComment: true, allowsComment: true },
            ];
            
            // Optimistically add statuses to local state with temporary IDs
            const tempStatuses: TaskStatusOption[] = defaultStatuses.map((s, index) => ({
                ...s,
                id: `temp-${Date.now()}-${index}` // temporary ID
            }));
            
            setProjects(prev => {
                const updateProject = (projects: Project[]): Project[] => {
                    return projects.map(p => {
                        if (p.id === projectId) {
                            return {
                                ...p,
                                taskStatusOptions: [...(p.taskStatusOptions || []), ...tempStatuses]
                            };
                        }
                        if (p.subProjects) {
                            return { ...p, subProjects: updateProject(p.subProjects) };
                        }
                        return p;
                    });
                };
                return updateProject(prev);
            });

            // Create statuses via API and collect real IDs
            const createdStatuses: TaskStatusOption[] = [];
            for (const s of defaultStatuses) {
                const created = await createProjectStatus(projectId, { 
                    label: s.name, // API expects 'label' but returns 'name'
                    color: s.color, 
                    order: s.order, 
                    showStrikeThrough: s.showStrikeThrough, 
                    hidden: s.hidden 
                });
                createdStatuses.push(created);
            }
            
            // Replace temporary statuses with real ones
            setProjects(prev => {
                const updateProject = (projects: Project[]): Project[] => {
                    return projects.map(p => {
                        if (p.id === projectId) {
                            return {
                                ...p,
                                taskStatusOptions: [
                                    ...(p.taskStatusOptions?.filter(s => !s.id.startsWith('temp-')) || []),
                                    ...createdStatuses
                                ]
                            };
                        }
                        if (p.subProjects) {
                            return { ...p, subProjects: updateProject(p.subProjects) };
                        }
                        return p;
                    });
                };
                return updateProject(prev);
            });
        } catch (error) {
            logger.error('Error adding default task statuses', { 
                userId: currentUser.id, 
                projectId,
                action: 'addDefaultTaskStatuses' 
            }, error);
            // Revert optimistic update on error
            await fetchData(currentUser.id);
            throw error;
        }
    };


  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const resp = await authLogin(email, password);
        
        // Check if it's an expected error response
        if (resp && 'success' in resp && resp.success === false && resp.isExpected) {
            logger.debug('Login failed - invalid credentials', {
                email,
                action: 'login',
                errorType: 'authentication_failed'
            });
            return { success: false, error: resp.error };
        }
        
        const user = resp?.user as User | undefined;
        if (user) {
          setCurrentUser(user);
          await fetchData(user.id);
          logger.info('User login successful', { 
            userId: user.id, 
            email,
            action: 'login' 
          });
          return { success: true };
        }
        return { success: false, error: 'Login failed' };
    } catch (error: any) {
        // For auth errors, log them differently to avoid scary console messages
        if (error?.status === 401 || error?.status === 400 || error?.isExpected) {
            logger.debug('Login failed - invalid credentials', {
                email,
                action: 'login',
                errorType: 'authentication_failed'
            });
        } else {
            logger.error('Login error', { 
                email,
                action: 'login',
                errorType: error?.body?.error || error?.message || 'unknown',
                status: error?.status
            }, error);
        }
        const errorMessage = error?.body?.error || error?.message || 'Login failed';
        return { success: false, error: errorMessage };
    }
  }

  const logout = async () => {
    try {
        await authLogout();
        clearState();
        clearAllCaches(); // Clear all cached data on logout
        router.push('/login');
    } catch (error: any) {
        // For logout errors, only log if they're unexpected (not auth failures)
        if (error?.status !== 401 && !error?.isExpected) {
            logger.error('Logout error', { 
                userId: currentUser?.id,
                action: 'logout' 
            }, error);
        }
    }
  }

  const addProject = async (project: Omit<Project, 'id' | 'subProjects'>) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
        const { parentProjectId, ...restOfProject } = project;
        // default owner membership handled by backend
        const payload: any = { ...restOfProject };
        if (parentProjectId) payload.parentProjectId = parentProjectId;
        
        const newProject = await createProject(payload);
        
        // Invalidate all project caches
        invalidateAllProjectCaches();
        
        // Instead of optimistic updates that may have wrong membership data,
        // refresh the projects list to get accurate access permissions
        await refreshProjects();
        
        return newProject;
    } catch (error) {
        console.error("Error adding project: ", error);
        throw error;
    }
  };

  const updateProject = async (projectId: string, projectData: Partial<Omit<Project, 'id' | 'subProjects'>>) => {
    if (!currentUser) throw new Error("User not authenticated");

    try {
        // Optimistically update project in local state
        setProjects(prev => {
            const updateProject = (projects: Project[]): Project[] => {
                return projects.map(p => {
                    if (p.id === projectId) {
                        const updated = { ...p, ...projectData };
                        // Update cache optimistically
                        optimisticUpdateProject(updated);
                        return updated;
                    }
                    if (p.subProjects) {
                        return { ...p, subProjects: updateProject(p.subProjects) };
                    }
                    return p;
                });
            };
            return updateProject(prev);
        });

        await updateProjectApi(projectId, projectData);
        
        // Invalidate project caches
        invalidateProjectCaches(projectId);
    } catch (error) {
        console.error("Error updating project(s): ", error);
        // Revert optimistic update on error
        if(currentUser?.id) await fetchData(currentUser.id);
        throw error;
    }
  };

  const getProject = async (projectId: string): Promise<Project | null> => {
    try {
        const resp = await apiGetProject(projectId);
        const proj = resp ? (normalizeProject(resp) as Project) : null;
        if (proj) {
            // upsert into local projects state so UI components using `projects` get the normalized project
            setProjects(prev => {
                // try to replace existing project in nested tree
                const replace = (arr: Project[]): Project[] => {
                    return arr.map(p => {
                        if (p.id === proj.id) return { ...proj, subProjects: p.subProjects || [] };
                        if (p.subProjects) return { ...p, subProjects: replace(p.subProjects) };
                        return p;
                    });
                };

                // if project exists somewhere, replace it
                const exists = (function find(arr: Project[]): boolean {
                    for (const p of arr) {
                        if (p.id === proj.id) return true;
                        if (p.subProjects && find(p.subProjects)) return true;
                    }
                    return false;
                })(prev);

                if (exists) return replace(prev);

                // otherwise append at root
                return [...prev, { ...(proj as any), subProjects: proj.subProjects || [] }];
            });
        }
        return proj;
    } catch (error) {
        console.error("Error getting project: ", error);
        return null;
    }
  };

    const duplicateProject = async (projectId: string) => {
        if (!currentUser) throw new Error("User not authenticated");

        try {
            const idMap = new Map<string, string>();
            
            const findProjectInState = (projs: Project[], pId: string): Project | null => {
                for (const p of projs) {
                    if (p.id === pId) return p;
                    if (p.subProjects) {
                        const found = findProjectInState(p.subProjects, pId);
                        if (found) return found;
                    }
                }
                return null;
            };

            const getProjectsToDuplicate = (project: Project): Project[] => {
                let list: Project[] = [project];
                if (project.subProjects) {
                    project.subProjects.forEach(sub => {
                        list = list.concat(getProjectsToDuplicate(sub));
                    });
                }
                return list;
            };

            const rootProjectToDuplicate = findProjectInState(projects, projectId);
            if (!rootProjectToDuplicate) throw new Error("Project to duplicate not found.");
            
            const allProjectsToDuplicate = getProjectsToDuplicate(rootProjectToDuplicate);
            const oldProjectIds = allProjectsToDuplicate.map(p => p.id);

            // duplication is complex; fall back to creating copies via backend where possible
            for (const p of allProjectsToDuplicate) {
                const { id, subProjects, members, ...projectData } = p;
                const payload: any = { ...projectData, name: `${p.name} (Copy)` };
                // backend should create new project and handle parent linkage
                await createProject(payload);
            }
            
            if (oldProjectIds.length > 0) {
                // duplicate tasks via backend: fetch and recreate
                // fetch tasks for each oldProjectId and create new ones
                for (const oldId of oldProjectIds) {
                    const tasks = await getTasksByProjectIds([oldId]);
                    for (const t of tasks) {
                        const newProjectId = idMap.get(t.projectId);
                        if (newProjectId) {
                            const { id: tid, ...taskData } = t;
                            await createTaskApi({ ...taskData, projectId: newProjectId });
                        }
                    }
                }
            }
            
            await refreshProjects();
            
        } catch (error) {
            console.error("Error duplicating project:", error);
            await refreshProjects();
            throw error;
        }
    };
    
    const deleteProject = async (projectId: string, pathname: string) => {
        if (!currentUser) throw new Error("User not authenticated");
    
        try {
            const getProjectIdsFromState = (allProjects: Project[], startId: string): string[] => {
                let ids: string[] = [];
                const findAndCollect = (projs: Project[], pId: string): boolean => {
                    for (const p of projs) {
                        if (p.id === pId) {
                            const collect = (proj: Project) => {
                                ids.push(proj.id);
                                if (proj.subProjects) {
                                    proj.subProjects.forEach(collect);
                                }
                            };
                            collect(p);
                            return true;
                        }
                        if (p.subProjects) {
                            if (findAndCollect(p.subProjects, pId)) return true;
                        }
                    }
                    return false;
                };
    
                findAndCollect(allProjects, startId);
                return ids;
            };
    
            const allProjectIdsToDelete = getProjectIdsFromState(projects, projectId);

            // Optimistically remove projects from local state
            setProjects(prev => {
                const removeProject = (projects: Project[], targetId: string): Project[] => {
                    return projects.filter(p => {
                        if (p.id === targetId) return false;
                        if (p.subProjects) {
                            p.subProjects = removeProject(p.subProjects, targetId);
                        }
                        return true;
                    });
                };
                
                let updatedProjects = prev;
                for (const pId of allProjectIdsToDelete) {
                    updatedProjects = removeProject(updatedProjects, pId);
                }
                return updatedProjects;
            });

            // Also optimistically remove related tasks
            setTasks(prev => prev.filter(task => !allProjectIdsToDelete.includes(task.projectId)));
    
            // delete projects via backend
            for (const pId of allProjectIdsToDelete) {
                await deleteProjectApi(pId);
            }
    
            const remainingProjectIds = new Set(allProjectIdsToDelete);
            const isViewingDeletedProject = [...remainingProjectIds].some(id => pathname.includes(id));

            if (isViewingDeletedProject) {
                router.push('/dashboard');
            }
            
        } catch (error) {
            console.error("FINAL DELETION ERROR:", error);
            // Revert optimistic update on error
            if(currentUser.id) {
                await fetchData(currentUser.id);
            }
            throw error;
        }
    };

  // Project Member Management
  const addProjectMemberFunc = async (projectId: string, userId: string, role: string) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      // Optimistically add member to local state
      setProjects(prev => {
        const updateProject = (projects: Project[]): Project[] => {
          return projects.map(p => {
            if (p.id === projectId) {
              return {
                ...p,
                members: {
                  ...(p.members || {}),
                  [userId]: role as ProjectRole
                }
              };
            }
            if (p.subProjects) {
              return { ...p, subProjects: updateProject(p.subProjects) };
            }
            return p;
          });
        };
        return updateProject(prev);
      });

      await addProjectMember(projectId, userId, role);
    } catch (error) {
      console.error("Error adding project member:", error);
      // Revert optimistic update on error
      await fetchData(currentUser.id);
      throw error;
    }
  };

  const updateProjectMemberRoleFunc = async (projectId: string, userId: string, role: string) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      // Optimistically update member role in local state
      setProjects(prev => {
        const updateProject = (projects: Project[]): Project[] => {
          return projects.map(p => {
            if (p.id === projectId && p.members) {
              return {
                ...p,
                members: {
                  ...p.members,
                  [userId]: role as ProjectRole
                }
              };
            }
            if (p.subProjects) {
              return { ...p, subProjects: updateProject(p.subProjects) };
            }
            return p;
          });
        };
        return updateProject(prev);
      });

      await updateProjectMemberRole(projectId, userId, role);
    } catch (error) {
      console.error("Error updating project member role:", error);
      // Revert optimistic update on error
      await fetchData(currentUser.id);
      throw error;
    }
  };

  const removeProjectMemberFunc = async (projectId: string, userId: string) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      // Optimistically remove member from local state
      setProjects(prev => {
        const updateProject = (projects: Project[]): Project[] => {
          return projects.map(p => {
            if (p.id === projectId && p.members) {
              const newMembers = { ...p.members };
              delete newMembers[userId];
              return {
                ...p,
                members: newMembers
              };
            }
            if (p.subProjects) {
              return { ...p, subProjects: updateProject(p.subProjects) };
            }
            return p;
          });
        };
        return updateProject(prev);
      });

      await removeProjectMember(projectId, userId);
    } catch (error) {
      console.error("Error removing project member:", error);
      // Revert optimistic update on error
      await fetchData(currentUser.id);
      throw error;
    }
  };


  const addTask = async (task: Omit<Task, 'id'>): Promise<Task> => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
        const body: any = { ...task };
        
        // Convert status field to statusId for API compatibility
        if (body.status) {
            body.statusId = body.status;
            delete body.status;
        }
        
        // remove undefined, null, and empty-string values to avoid sending invalid FK references
        Object.keys(body).forEach(k => {
            if (body[k] === undefined || body[k] === null || (typeof body[k] === 'string' && body[k].trim() === '')) {
                delete body[k];
            }
        });
        
        // Call API to create task
        const newTask = await createTaskApi(body);
        
        // Invalidate task caches for affected projects
        if (newTask && newTask.projectId) {
            invalidateTaskCaches(newTask);
        }
        
        // Optimistically add the task to local state (SSE will also broadcast, but we have duplicate protection)
        if (newTask) {
            const normalizedTask = {
                ...newTask,
                status: newTask.status ?? newTask.statusId ?? null,
                assigneeId: newTask.assigneeId ?? undefined,
                parentId: newTask.parentId ?? undefined,
            };
            
            setTasks(prev => {
                // Extra safety check to prevent duplicates
                if (prev.find(t => t.id === normalizedTask.id)) {
                    return prev;
                }
                return [...prev, normalizedTask];
            });
            
            return normalizedTask;
        }
        
        throw new Error('Failed to create task');

    } catch (error) {
        console.error("Error adding task: ", error);
        throw error;
    }
  };

  const updateTask = async (updatedTask: Task) => {
    if (!currentUser) throw new Error("User not authenticated");
    
    try {
        const { id, ...taskData } = updatedTask;
        const body: any = { ...taskData };
        // remove undefined fields
        Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);

        // strip server-only timestamp fields if present
        delete body.createdAt;
        delete body.updatedAt;

        // Normalize status: ensure we send only `statusId` (backend accepts either but prefers statusId when both present).
        // If the caller provided `status` (new id), use it; otherwise keep any explicit statusId.
        if (body.status !== undefined) {
            body.statusId = body.status;
        }
        // remove client-side `status` field to avoid sending both
        delete body.status;

        // optimistic update: merge the requested changes into local state so UI updates immediately
        const optimistic = {
            ...updatedTask,
            // ensure we reflect the requested statusId/status shape
            status: body.statusId ?? updatedTask.status ?? null,
            assigneeId: body.assigneeId !== undefined ? body.assigneeId : updatedTask.assigneeId,
            parentId: body.parentId !== undefined ? body.parentId : updatedTask.parentId,
        };
        
        // Update local state
        setTasks(prev => prev.map(t => t.id === id ? optimistic : t));
        
        // Update cache optimistically
        optimisticUpdateTask(optimistic);

        // call API and reconcile response
        const resp: any = await updateTaskApi(id, body);

        // Invalidate task caches for affected projects
        invalidateTaskCaches(optimistic);

        // normalize response to frontend shape (match fetchTasksForChunks normalization)
        const normalized = {
            ...resp,
            status: resp.status ?? resp.statusId ?? null,
            assigneeId: resp.assigneeId ?? undefined,
            parentId: resp.parentId ?? undefined,
        };

        // reconcile authoritative server response
        setTasks(prev => prev.map(t => t.id === normalized.id ? normalized : t));

    } catch (error) {
        console.error("Error updating task: ", error);
        // Invalidate cache to force refresh on error
        if (updatedTask.projectId) {
            invalidateTaskCaches(updatedTask);
        }
    }
  };

  // Fast update for drag operations - only updates UI, debounces API calls
  const updateTaskImmediate = useCallback((updatedTask: Task) => {
    if (!currentUser) return;

    // Update UI immediately
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));

    // Store the pending update
    pendingTaskUpdates.current.set(updatedTask.id, updatedTask);

    // Clear existing timeout for this task
    const existingTimeout = updateTaskTimeouts.current.get(updatedTask.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new debounced API call
    const timeout = setTimeout(async () => {
      const taskToUpdate = pendingTaskUpdates.current.get(updatedTask.id);
      if (taskToUpdate) {
        try {
          const { id, ...taskData } = taskToUpdate;
          const body: any = { ...taskData };
          Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);

          delete body.createdAt;
          delete body.updatedAt;

          if (body.status !== undefined) {
            body.statusId = body.status;
          }
          delete body.status;

          await updateTaskApi(id, body);
          
          // Clean up
          pendingTaskUpdates.current.delete(updatedTask.id);
          updateTaskTimeouts.current.delete(updatedTask.id);
        } catch (error) {
          console.error("Error in debounced task update:", error);
          // Revert to server state on error
          if (currentUser?.id) await fetchData(currentUser.id);
        }
      }
    }, 500); // 500ms debounce

    updateTaskTimeouts.current.set(updatedTask.id, timeout);
  }, [currentUser]);
  
  const deleteTask = async (taskId: string) => {
    if (!currentUser) throw new Error("User not authenticated");
    
    try {
        // Optimistically remove the task from local state
        setTasks(prev => prev.filter(t => t.id !== taskId));
        
        // Call API to delete task
        await deleteTaskApi(taskId);
    } catch (error) {
        console.error("Error deleting task: ", error);
        // Revert the optimistic update by refetching on error
        if (currentUser?.id) await fetchData(currentUser.id);
        throw error;
    }
  };

  const updateUser = async (userId: string, userData: Partial<Pick<User, 'name' | 'email' | 'avatarUrl'>>) => {
    if (!currentUser) throw new Error("User not authenticated");
        try {
            const resp: any = await updateUserApi(userId, { name: userData.name, email: userData.email });
            const updated = resp?.user || { id: userId, ...userData };

            setUsers(prevUsers => {
                const newUsers = new Map(prevUsers);
                if (newUsers.has(userId)) {
                    const existingUser = newUsers.get(userId)!;
                    newUsers.set(userId, { ...existingUser, ...updated });
                }
                return newUsers;
            });

            if (currentUser.id === userId) {
                setCurrentUser(prev => prev ? { ...prev, ...updated } : null);
            }
        } catch (error) {
            console.error("Error updating user:", error);
            throw error;
        }
  };

    const createUser = async (user: Omit<User, 'id'>, password: string) => {
        const resp = await authSignup(user.name, user.email, password);
        
        // Check if it's an expected error response
        if (resp && 'success' in resp && resp.success === false && resp.isExpected) {
            logger.debug('Signup failed - user input error', {
                email: user.email,
                action: 'signup',
                errorType: 'user_input_error'
            });
            // Create a plain error object without throwing to avoid console logging
            const error = {
                message: resp.error,
                status: resp.status,
                isExpected: true
            };
            throw error;
        }
        
        const created = resp?.user as User | undefined;
        if (created) {
            // Optionally update local users list
            setUsers(prev => {
                const newUsers = new Map(prev);
                newUsers.set(created.id, created);
                return newUsers;
            });
            setCurrentUser(created);
            await fetchData(created.id);
        }
    };

    const addProjectTaskStatus = async (projectId: string, status: Omit<TaskStatusOption, 'id'>) => {
        if (!currentUser) throw new Error('User not authenticated');
        
        try {
            // Generate a temporary ID for optimistic update
            const tempId = `temp-${Date.now()}`;
            const existingStatuses = (() => {
                const project = projects.find(p => p.id === projectId);
                return project?.taskStatusOptions || [];
            })();
            const newOrder = existingStatuses.length;
            
            // Create optimistic status object
            const optimisticStatus: TaskStatusOption = {
                id: tempId,
                name: (status as any).name || (status as any).label || 'Status',
                color: (status as any).color || '#3B82F6',
                order: newOrder,
                showStrikeThrough: (status as any).showStrikeThrough || false,
                hidden: (status as any).hidden || false,
                requiresComment: (status as any).requiresComment || false,
                allowsComment: (status as any).allowsComment !== false
            };

            // Optimistically add the status to local state
            setProjects(prev => {
                const updateProject = (projects: Project[]): Project[] => {
                    return projects.map(p => {
                        if (p.id === projectId) {
                            return {
                                ...p,
                                taskStatusOptions: [...(p.taskStatusOptions || []), optimisticStatus]
                            };
                        }
                        if (p.subProjects) {
                            return { ...p, subProjects: updateProject(p.subProjects) };
                        }
                        return p;
                    });
                };
                return updateProject(prev);
            });

            // Call API to create status
            const createdStatus = await createProjectStatus(projectId, { 
                label: optimisticStatus.name, 
                color: optimisticStatus.color, 
                order: newOrder, 
                showStrikeThrough: optimisticStatus.showStrikeThrough, 
                hidden: optimisticStatus.hidden,
                requiresComment: optimisticStatus.requiresComment,
                allowsComment: optimisticStatus.allowsComment
            });

            // Replace temp status with real one
            setProjects(prev => {
                const updateProject = (projects: Project[]): Project[] => {
                    return projects.map(p => {
                        if (p.id === projectId && p.taskStatusOptions) {
                            return {
                                ...p,
                                taskStatusOptions: p.taskStatusOptions.map(s => 
                                    s.id === tempId ? { ...createdStatus, name: createdStatus.label || createdStatus.name } : s
                                )
                            };
                        }
                        if (p.subProjects) {
                            return { ...p, subProjects: updateProject(p.subProjects) };
                        }
                        return p;
                    });
                };
                return updateProject(prev);
            });
        } catch (error) {
            console.error('Error adding project task status:', error);
            // Revert optimistic update on error
            if (currentUser?.id) await fetchData(currentUser.id);
            throw error;
        }
    };

    const updateProjectTaskStatus = async (projectId: string, statusId: string, statusData: Partial<Omit<TaskStatusOption, 'id'>>) => {
        if (!currentUser) throw new Error('User not authenticated');
        
        try {
            // Optimistically update the project status in local state
            setProjects(prev => {
                const updateProject = (projects: Project[]): Project[] => {
                    return projects.map(p => {
                        if (p.id === projectId && p.taskStatusOptions) {
                            return {
                                ...p,
                                taskStatusOptions: p.taskStatusOptions.map(s => 
                                    s.id === statusId ? { ...s, ...statusData } : s
                                )
                            };
                        }
                        if (p.subProjects) {
                            return { ...p, subProjects: updateProject(p.subProjects) };
                        }
                        return p;
                    });
                };
                return updateProject(prev);
            });

            // Call API to update status
            await updateProjectStatus(projectId, statusId, { 
                label: (statusData as any).name || (statusData as any).label, 
                order: (statusData as any).order, 
                color: (statusData as any).color, 
                showStrikeThrough: (statusData as any).showStrikeThrough, 
                hidden: (statusData as any).hidden,
                requiresComment: (statusData as any).requiresComment,
                allowsComment: (statusData as any).allowsComment
            });
        } catch (error) {
            console.error('Error updating project task status:', error);
            // Revert optimistic update on error
            if (currentUser?.id) await fetchData(currentUser.id);
            throw error;
        }
    };

    const deleteProjectTaskStatus = async (projectId: string, statusId: string) => {
        if (!currentUser) throw new Error('User not authenticated');
        
        try {
            // Optimistically remove the status from local state
            setProjects(prev => {
                const updateProject = (projects: Project[]): Project[] => {
                    return projects.map(p => {
                        if (p.id === projectId && p.taskStatusOptions) {
                            return {
                                ...p,
                                taskStatusOptions: p.taskStatusOptions.filter(s => s.id !== statusId)
                            };
                        }
                        if (p.subProjects) {
                            return { ...p, subProjects: updateProject(p.subProjects) };
                        }
                        return p;
                    });
                };
                return updateProject(prev);
            });

            // Call API to delete status
            await deleteProjectStatus(projectId, statusId);
        } catch (error) {
            console.error('Error deleting project task status:', error);
            // Revert optimistic update on error
            if (currentUser?.id) await fetchData(currentUser.id);
            throw error;
        }
    };

    const updateProjectTaskStatusOrder = async (projectId: string, statuses: TaskStatusOption[]) => {
        if (!currentUser) throw new Error('User not authenticated');
        
        try {
            // Optimistically update the order in local state
            setProjects(prev => {
                const updateProject = (projects: Project[]): Project[] => {
                    return projects.map(p => {
                        if (p.id === projectId && p.taskStatusOptions) {
                            // Create a map for quick lookup of new orders
                            const orderMap = new Map(statuses.map(s => [s.id, s.order]));
                            return {
                                ...p,
                                taskStatusOptions: p.taskStatusOptions
                                    .map(s => ({ ...s, order: orderMap.get(s.id) ?? s.order }))
                                    .sort((a, b) => a.order - b.order)
                            };
                        }
                        if (p.subProjects) {
                            return { ...p, subProjects: updateProject(p.subProjects) };
                        }
                        return p;
                    });
                };
                return updateProject(prev);
            });

            // Call API to update order
            const payload = statuses.map(s => ({ id: s.id, order: s.order }));
            await updateProjectStatusesOrder(projectId, payload);
        } catch (error) {
            console.error('Error updating project task status order:', error);
            // Revert optimistic update on error
            if (currentUser?.id) await fetchData(currentUser.id);
            throw error;
        }
    };


    const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
        try {
            await authChangePassword(currentPassword, newPassword);
        } catch (error) {
            console.error('Error changing password:', error);
            throw error;
        }
    };

  const findUserByEmail = async (email: string): Promise<User | null> => {
    // Prefer searching cached users; fall back to API fetch
    const found = Array.from(users.values()).find(u => u.email === email);
    if (found) return found;
    try {
        const all = await getUsers();
        const arr = (all || []) as User[];
        const match = arr.find(u => u.email === email) || null;
        return match;
    } catch (err) {
        console.error('Error finding user by email via backend:', err);
        return null;
    }
  };

  const findUserByEmailOrName = async (query: string): Promise<User | null> => {
    // Prefer searching cached users; fall back to API fetch
    const found = Array.from(users.values()).find(u => u.email === query || u.name === query);
    if (found) return found;
    try {
        const all = await getUsers();
        const arr = (all || []) as User[];
        const match = arr.find(u => u.email === query || u.name === query) || null;
        return match;
    } catch (err) {
        console.error('Error finding user by email or name via backend:', err);
        return null;
    }
  };

  const contextValue = useMemo(() => ({
    users, projects, tasks, loading, currentUser, 
    login, logout, addProject, updateProject, getProject, duplicateProject, 
    addProjectMember: addProjectMemberFunc, updateProjectMemberRole: updateProjectMemberRoleFunc, removeProjectMember: removeProjectMemberFunc,
    addTask, updateTask, updateTaskImmediate, deleteTask, updateUser, createUser, changePassword, findUserByEmail, findUserByEmailOrName, 
    deleteProject, isKanbanHeaderVisible,
    toggleKanbanHeader, isSidebarOpenByDefault, toggleSidebarDefault,
    cardDensity, setCardDensity,
    defaultView, setDefaultView,
    groupByStatus, setGroupByStatus,
    addProjectTaskStatus, updateProjectTaskStatus, deleteProjectTaskStatus, updateProjectTaskStatusOrder, addDefaultTaskStatuses
  }), [
    users, projects, tasks, loading, currentUser, 
    login, logout, addProject, updateProject, getProject, duplicateProject, 
    addProjectMemberFunc, updateProjectMemberRoleFunc, removeProjectMemberFunc,
    addTask, updateTask, updateTaskImmediate, deleteTask, updateUser, createUser, changePassword, findUserByEmail, findUserByEmailOrName, 
    deleteProject, isKanbanHeaderVisible,
    toggleKanbanHeader, isSidebarOpenByDefault, toggleSidebarDefault,
    cardDensity, setCardDensity,
    defaultView, setDefaultView,
    groupByStatus, setGroupByStatus,
    addProjectTaskStatus, updateProjectTaskStatus, deleteProjectTaskStatus, updateProjectTaskStatusOrder, addDefaultTaskStatuses
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

