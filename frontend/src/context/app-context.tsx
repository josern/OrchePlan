'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { db, auth } from '@/lib/firebase';
import { 
  collection, getDocs, doc, writeBatch, query, getDoc, 
  where, updateDoc, setDoc, deleteDoc, addDoc, onSnapshot, orderBy,
  QuerySnapshot, DocumentData
} from 'firebase/firestore';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    type User as AuthUser
} from 'firebase/auth';
import { User, Project, Task, TaskStatusOption, ProjectRole } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';

interface AppContextType {
  users: User[];
  projects: Project[];
  tasks: Task[];
  currentUser: User | null;
  loading: boolean;
  isKanbanHeaderVisible: boolean;
  isSidebarOpenByDefault: boolean;
  toggleSidebarDefault: () => void;
  toggleKanbanHeader: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  addProject: (project: Omit<Project, 'id' | 'subProjects'>) => Promise<void>;
  updateProject: (projectId: string, projectData: Partial<Omit<Project, 'id' | 'subProjects'>>) => Promise<void>;
  deleteProject: (projectId: string, pathname: string) => Promise<void>;
  getProject: (projectId: string) => Promise<Project | null>;
  duplicateProject: (projectId: string) => Promise<void>;
  addTask: (task: Omit<Task, 'id'>) => Promise<void>;
  updateTask: (updatedTask: Task) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  updateUser: (userId: string, userData: Partial<Pick<User, 'name' | 'email' | 'avatarUrl'>>) => Promise<void>;
  createUser: (user: Omit<User, 'id'>, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  findUserByEmail: (email: string) => Promise<User | null>;
  addProjectTaskStatus: (projectId: string, status: Omit<TaskStatusOption, 'id'>) => Promise<void>;
  updateProjectTaskStatus: (projectId: string, statusId: string, statusData: Partial<Omit<TaskStatusOption, 'id'>>) => Promise<void>;
  deleteProjectTaskStatus: (projectId: string, statusId: string) => Promise<void>;
  updateProjectTaskStatusOrder: (projectId: string, statuses: TaskStatusOption[]) => Promise<void>;
  addDefaultTaskStatuses: (projectId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isKanbanHeaderVisible, setIsKanbanHeaderVisible] = useState(true);
  const [isSidebarOpenByDefault, setIsSidebarOpenByDefault] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('sidebar_default_open='))
      ?.split('=')[1];
    if (cookieValue) {
      setIsSidebarOpenByDefault(cookieValue === 'true');
    }
  }, []);

  const toggleSidebarDefault = () => {
    setIsSidebarOpenByDefault(prevState => {
      const newState = !prevState;
      document.cookie = `sidebar_default_open=${newState};path=/;max-age=31536000`; // Expires in 1 year
      return newState;
    });
  };

  const toggleKanbanHeader = () => {
    setIsKanbanHeaderVisible(prevState => !prevState);
  };

  const clearState = () => {
    setUsers([]);
    setProjects([]);
    setTasks([]);
    setCurrentUser(null);
  }

  const fetchData = useCallback(async (currentUserId: string) => {
    setLoading(true);
    try {
        const projectsQuery = query(collection(db, "projects"), where(`members.${currentUserId}`, "in", ['owner', 'editor', 'viewer']));
        const projectsSnapshot = await getDocs(projectsQuery);
        const allProjectsFlat = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));

        for (const project of allProjectsFlat) {
          const projectStatusesQuery = query(collection(db, 'projects', project.id, 'task_statuses'), orderBy("order"));
          const projectStatusesSnapshot = await getDocs(projectStatusesQuery);
          project.taskStatusOptions = projectStatusesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskStatusOption));
        }

        const projectMap = new Map<string, Project & { subProjects: Project[] }>();
        allProjectsFlat.forEach(p => {
            projectMap.set(p.id, { ...p, subProjects: [] });
        });

        const nestedProjects: Project[] = [];
        projectMap.forEach(project => {
            if (project.parentProjectId) {
                const parent = projectMap.get(project.parentProjectId);
                if (parent) {
                    parent.subProjects.push(project);
                } else {
                    nestedProjects.push(project);
                }
            } else {
                nestedProjects.push(project);
            }
        });

        setProjects(nestedProjects);
        
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setUsers(allUsers);

    } catch (error) {
        console.error("Error fetching initial data from Firestore:", error);
    } finally {
        setLoading(false);
    }
  }, []);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser: AuthUser | null) => {
        if (authUser) {
            const userDoc = await getDoc(doc(db, 'users', authUser.uid));
            if (userDoc.exists()) {
                const userData = { id: userDoc.id, ...userDoc.data() } as User;
                setCurrentUser(userData);
                await fetchData(userData.id);
            } else {
                console.warn("User document not found in Firestore for authenticated user.");
                await signOut(auth);
            }
        } else {
            clearState();
            setLoading(false);
        }
    });

    return () => unsubscribe();
  }, [fetchData]);

  useEffect(() => {
    if (loading) return;

    if (!currentUser && pathname !== '/login' && pathname !== '/signup') {
      router.push('/login');
    }
  }, [currentUser, loading, pathname, router]);

  useEffect(() => {
    if (!currentUser || projects.length === 0) {
        setTasks([]);
        return;
    }

    const getAllProjectIds = (projs: Project[]): string[] => {
        let ids: string[] = [];
        projs.forEach(p => {
            ids.push(p.id);
            if (p.subProjects) {
                ids = ids.concat(getAllProjectIds(p.subProjects));
            }
        });
        return ids;
    };

    const allProjectIds = getAllProjectIds(projects);

    if (allProjectIds.length === 0) {
        setTasks([]);
        return;
    }

    const CHUNK_SIZE = 30;
    const projectChunks = [];
    for (let i = 0; i < allProjectIds.length; i += CHUNK_SIZE) {
        projectChunks.push(allProjectIds.slice(i, i + CHUNK_SIZE));
    }

    let activeTasks: { [key: string]: Task } = {};

    const unsubscribes = projectChunks.map(chunk => {
        const tasksQuery = query(collection(db, "tasks"), where("projectId", "in", chunk));
        return onSnapshot(tasksQuery, (querySnapshot: QuerySnapshot<DocumentData>) => {
            querySnapshot.docChanges().forEach((change) => {
                const taskData = { id: change.doc.id, ...change.doc.data() } as Task;
                if (change.type === "removed") {
                    delete activeTasks[taskData.id];
                } else {
                    activeTasks[taskData.id] = taskData;
                }
            });
            setTasks(Object.values(activeTasks));
        }, (error) => {
            console.error(`Error listening to task updates for project chunk:`, error);
        });
    });

    return () => {
        unsubscribes.forEach(unsub => unsub());
    };
}, [currentUser, projects]);

  const addDefaultTaskStatuses = async (projectId: string) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
        const batch = writeBatch(db);
        const defaultStatuses = [
            { name: 'To Do', color: '#3B82F6', order: 0 },
            { name: 'In Progress', color: '#EAB308', order: 1 },
            { name: 'Blocked', color: '#EF4444', order: 2 },
            { name: 'Done', color: '#22C55E', order: 3 },
        ];

        defaultStatuses.forEach(status => {
            const docRef = doc(collection(db, 'projects', projectId, 'task_statuses'));
            batch.set(docRef, status);
        });

        await batch.commit();
        await fetchData(currentUser.id);
    } catch (error) {
        console.error("Error adding default task statuses: ", error);
        throw error;
    }
  };


  const login = async (email: string, password: string): Promise<boolean> => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        return true;
    } catch (error) {
        console.error('Login error:', error);
        return false;
    }
  }

  const logout = async () => {
    try {
        await signOut(auth);
        clearState();
        router.push('/login');
    } catch (error) {
        console.error('Logout error:', error);
    }
  }

  const addProject = async (project: Omit<Project, 'id' | 'subProjects'>) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
        const newDocRef = doc(collection(db, 'projects'));
        const { parentProjectId, ...restOfProject } = project;

        let members: Record<string, ProjectRole> = { [currentUser.id]: 'owner' };

        if (parentProjectId) {
            const parentProject = await getProject(parentProjectId);
            if (parentProject && parentProject.members) {
                members = parentProject.members;
            }
        }

        const newProjectData: any = {
            ...restOfProject,
            members,
        };

        if (parentProjectId) {
            newProjectData.parentProjectId = parentProjectId;
        }

        await setDoc(newDocRef, newProjectData);
        await addDefaultTaskStatuses(newDocRef.id);
    } catch (error) {
        console.error("Error adding project: ", error);
        throw error;
    }
  };

  const updateProject = async (projectId: string, projectData: Partial<Omit<Project, 'id' | 'subProjects'>>) => {
    if (!currentUser) throw new Error("User not authenticated");

    const getSubProjectIdsFromState = (allProjects: Project[], startId: string): string[] => {
        let ids: string[] = [];
        const findAndCollect = (projs: Project[], pId: string): boolean => {
            for (const p of projs) {
                if (p.id === pId) {
                    const collect = (proj: Project) => {
                        if (proj.subProjects) {
                            proj.subProjects.forEach(sub => {
                                ids.push(sub.id);
                                collect(sub);
                            });
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

    try {
        const batch = writeBatch(db);
        const mainProjectRef = doc(db, 'projects', projectId);
        batch.update(mainProjectRef, projectData);

        if (projectData.members) {
            const allSubProjectIds = getSubProjectIdsFromState(projects, projectId);
            allSubProjectIds.forEach(subProjectId => {
                const subProjectRef = doc(db, 'projects', subProjectId);
                batch.update(subProjectRef, { members: projectData.members });
            });
        }

        await batch.commit();
        await fetchData(currentUser.id);

    } catch (error) {
        console.error("Error updating project(s): ", error);
        if(currentUser?.id) await fetchData(currentUser.id);
        throw error;
    }
  };

  const getProject = async (projectId: string): Promise<Project | null> => {
    try {
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);
        if (projectSnap.exists()) {
            return { id: projectSnap.id, ...projectSnap.data() } as Project;
        }
        return null;
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

            const projectBatch = writeBatch(db);
            allProjectsToDuplicate.forEach(p => {
                const newId = doc(collection(db, 'projects')).id;
                idMap.set(p.id, newId);
                const { id, subProjects, members, ...projectData } = p;
                
                const newProjectData: any = {
                    ...projectData,
                    name: `${p.name} (Copy)`,
                    members: { [currentUser.id]: 'owner' as ProjectRole },
                };
                
                if (p.parentProjectId && idMap.has(p.parentProjectId)) {
                    newProjectData.parentProjectId = idMap.get(p.parentProjectId);
                } else if (p.parentProjectId && !idMap.has(p.parentProjectId)) {
                     newProjectData.parentProjectId = p.parentProjectId;
                }
                
                projectBatch.set(doc(db, 'projects', newId), newProjectData);
            });
            await projectBatch.commit();
            
            if (oldProjectIds.length > 0) {
                const taskQuery = query(collection(db, 'tasks'), where('projectId', 'in', oldProjectIds));
                const tasksSnapshot = await getDocs(taskQuery);

                if (!tasksSnapshot.empty) {
                    const taskBatch = writeBatch(db);
                    tasksSnapshot.docs.forEach(taskDoc => {
                        const taskData = taskDoc.data() as Omit<Task, 'id'>;
                        const newProjectId = idMap.get(taskData.projectId);
                        if (newProjectId) {
                            const newTaskDocRef = doc(collection(db, 'tasks'));
                            const newTaskData = { ...taskData, projectId: newProjectId };
                            taskBatch.set(newTaskDocRef, newTaskData);
                        }
                    });
                    await taskBatch.commit();
                }
            }
            
            await fetchData(currentUser.id);
            
        } catch (error) {
            console.error("Error duplicating project:", error);
            if(currentUser?.id) await fetchData(currentUser.id);
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
    
            if (allProjectIdsToDelete.length > 0) {
                const CHUNK_SIZE = 10;
                for (let i = 0; i < allProjectIdsToDelete.length; i += CHUNK_SIZE) {
                    const chunk = allProjectIdsToDelete.slice(i, i + CHUNK_SIZE);
                    const taskQuery = query(collection(db, 'tasks'), where('projectId', 'in', chunk));
                    const taskSnapshots = await getDocs(taskQuery);
    
                    if (!taskSnapshots.empty) {
                        const taskBatch = writeBatch(db);
                        taskSnapshots.forEach(taskDoc => {
                            taskBatch.delete(taskDoc.ref);
                        });
                        await taskBatch.commit();
                    }
                }
            }
    
            const projectBatch = writeBatch(db);
            allProjectIdsToDelete.forEach(pId => {
                projectBatch.delete(doc(db, 'projects', pId));
            });
            await projectBatch.commit();
    
            await fetchData(currentUser.id);
    
            const remainingProjectIds = new Set(allProjectIdsToDelete);
            const isViewingDeletedProject = [...remainingProjectIds].some(id => pathname.includes(id));

            if (isViewingDeletedProject) {
                router.push('/dashboard');
            }
            
        } catch (error) {
            console.error("FINAL DELETION ERROR:", error);
            if(currentUser.id) {
                await fetchData(currentUser.id);
            }
            throw error;
        }
    };


  const addTask = async (task: Omit<Task, 'id'>) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
        const taskDataForFirestore: { [key: string]: any } = { ...task };
        
        Object.keys(taskDataForFirestore).forEach(key => {
            if (taskDataForFirestore[key] === undefined) {
                delete taskDataForFirestore[key];
            }
        });

        await addDoc(collection(db, 'tasks'), taskDataForFirestore);

    } catch (error) {
        console.error("Error adding task: ", error);
        throw error;
    }
  };

  const updateTask = async (updatedTask: Task) => {
    if (!currentUser) throw new Error("User not authenticated");
    
    try {
        const taskRef = doc(db, 'tasks', updatedTask.id);
        const { id, ...taskData } = updatedTask;
        
        const cleanTaskData: { [key: string]: any } = { ...taskData };
        Object.keys(cleanTaskData).forEach(key => {
            if (cleanTaskData[key] === undefined) {
                delete cleanTaskData[key];
            }
        });
        
        await updateDoc(taskRef, cleanTaskData);
    } catch (error) {
        console.error("Error updating task: ", error);
    }
  };
  
  const deleteTask = async (taskId: string) => {
    if (!currentUser) throw new Error("User not authenticated");
    
    try {
        await deleteDoc(doc(db, 'tasks', taskId));
    } catch (error) {
        console.error("Error deleting task: ", error);
        throw error;
    }
  };

  const updateUser = async (userId: string, userData: Partial<Pick<User, 'name' | 'email' | 'avatarUrl'>>) => {
    if (!currentUser) throw new Error("User not authenticated");
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, userData);
      
      setUsers(prevUsers => prevUsers.map(u => u.id === userId ? { ...u, ...userData } : u));

      if (currentUser.id === userId) {
        setCurrentUser(prev => prev ? { ...prev, ...userData } : null);
      }

    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const createUser = async (user: Omit<User, 'id'>, password: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, user.email, password);
      const authUser = userCredential.user;
      
      const newUser = {
          ...user,
      };

      await setDoc(doc(db, 'users', authUser.uid), newUser);
    } catch (error) {
      console.error("Error creating user: ", error);
      throw error;
    }
  };

  const addProjectTaskStatus = async (projectId: string, status: Omit<TaskStatusOption, 'id'>) => {
    if (!currentUser) throw new Error("User not authenticated");
    const statusesRef = collection(db, 'projects', projectId, 'task_statuses');
    const q = query(statusesRef);
    const snapshot = await getDocs(q);
    const newOrder = snapshot.size > 0 ? snapshot.size : 0;
    await addDoc(statusesRef, { ...status, order: newOrder });
    await fetchData(currentUser.id);
  };

  const updateProjectTaskStatus = async (projectId: string, statusId: string, statusData: Partial<Omit<TaskStatusOption, 'id'>>) => {
    if (!currentUser) throw new Error("User not authenticated");
    const statusRef = doc(db, 'projects', projectId, 'task_statuses', statusId);
    await updateDoc(statusRef, statusData);
    await fetchData(currentUser.id);
  };

  const deleteProjectTaskStatus = async (projectId: string, statusId: string) => {
    if (!currentUser) throw new Error("User not authenticated");
    const statusRef = doc(db, 'projects', projectId, 'task_statuses', statusId);
    await deleteDoc(statusRef);
    await fetchData(currentUser.id);
  };

  const updateProjectTaskStatusOrder = async (projectId: string, statuses: TaskStatusOption[]) => {
    if (!currentUser) throw new Error("User not authenticated");
    const batch = writeBatch(db);
    statuses.forEach((status, index) => {
      const statusRef = doc(db, 'projects', projectId, 'task_statuses', status.id);
      batch.update(statusRef, { order: index });
    });
    await batch.commit();
    await fetchData(currentUser.id);
  };


  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error("User not authenticated or email is missing.");
    }
  
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    
    try {
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
    } catch (error) {
      console.error("Error changing password:", error);
      throw error;
    }
  };

  const findUserByEmail = async (email: string): Promise<User | null> => {
    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            return { id: userDoc.id, ...userDoc.data() } as User;
        }
        return null;
    } catch (error) {
        console.error("Error finding user by email: ", error);
        return null;
    }
  };

  return (
    <AppContext.Provider value={{
      users, projects, tasks, loading, currentUser, 
      login, logout, addProject, updateProject, getProject, duplicateProject, 
      addTask, updateTask, deleteTask, updateUser, createUser, changePassword, findUserByEmail, 
      deleteProject, isKanbanHeaderVisible,
      toggleKanbanHeader, isSidebarOpenByDefault, toggleSidebarDefault,
      addProjectTaskStatus, updateProjectTaskStatus, deleteProjectTaskStatus, updateProjectTaskStatusOrder, addDefaultTaskStatuses
    }}>
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
