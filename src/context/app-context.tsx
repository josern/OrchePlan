'use client'

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
  taskStatusOptions: TaskStatusOption[];
  currentUser: User | null;
  loading: boolean;
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
  addTaskStatus: (status: Omit<TaskStatusOption, 'id'>) => Promise<void>;
  updateTaskStatus: (statusId: string, statusData: Partial<Omit<TaskStatusOption, 'id'>>) => Promise<void>;
  deleteTaskStatus: (statusId: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  findUserByEmail: (email: string) => Promise<User | null>;
  setTaskStatusOptions: React.Dispatch<React.SetStateAction<TaskStatusOption[]>>;
  updateTaskStatusOrder: (statuses: TaskStatusOption[]) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);


export function AppProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskStatusOptions, setTaskStatusOptions] = useState<TaskStatusOption[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const clearState = () => {
    setUsers([]);
    setProjects([]);
    setTasks([]);
    setTaskStatusOptions([]);
    setCurrentUser(null);
  }

  const fetchData = useCallback(async (currentUserId: string) => {
    setLoading(true);
    try {
        // Statuses
        const statusesQuery = query(collection(db, "task_statuses"), orderBy("order"));
        const statusesSnapshot = await getDocs(statusesQuery);
        let statuses = statusesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskStatusOption));
        
        if (statuses.length === 0) {
            const batch = writeBatch(db);
            const defaultStatuses = [
                { name: 'To Do', color: '#3B82F6', order: 0 },
                { name: 'In Progress', color: '#EAB308', order: 1 },
                { name: 'Blocked', color: '#EF4444', order: 2 },
                { name: 'Done', color: '#22C55E', order: 3 },
            ];

            defaultStatuses.forEach(status => {
                const docRef = doc(collection(db, 'task_statuses'));
                batch.set(docRef, status);
            });

            await batch.commit();
            const newStatusesSnapshot = await getDocs(statusesQuery);
            statuses = newStatusesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskStatusOption));
        }
        setTaskStatusOptions(statuses);

        // Projects
        const projectsQuery = query(collection(db, "projects"), where(`members.${currentUserId}`, "in", ['owner', 'editor', 'viewer']));
        const projectsSnapshot = await getDocs(projectsQuery);
        const allProjectsFlat = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));

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
                    // This case can happen if a user has access to a sub-project but not its parent.
                    nestedProjects.push(project);
                }
            } else {
                nestedProjects.push(project);
            }
        });

        setProjects(nestedProjects);
        
        // Users
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
    if (!currentUser) return;

    const q = query(collection(db, "task_statuses"), orderBy("order"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const statuses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskStatusOption));
        setTaskStatusOptions(statuses);
    });

    return () => unsubscribe();
  }, [currentUser]);

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

    const CHUNK_SIZE = 30; // Firestore 'in' query limit is 30
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
        await fetchData(currentUser.id);
    } catch (error) {
        console.error("Error adding project: ", error);
        throw error;
    }
  };

  const updateProject = async (projectId: string, projectData: Partial<Omit<Project, 'id' | 'subProjects'>>) => {
    if (!currentUser) throw new Error("User not authenticated");

    const getAllSubProjectIds = async (pId: string): Promise<string[]> => {
        let ids: string[] = [];
        const q = query(collection(db, 'projects'), where('parentProjectId', '==', pId));
        const snapshot = await getDocs(q);
        for (const document of snapshot.docs) {
            ids.push(document.id);
            const subIds = await getAllSubProjectIds(document.id);
            ids = ids.concat(subIds);
        }
        return ids;
    };

    try {
        const batch = writeBatch(db);
        const mainProjectRef = doc(db, 'projects', projectId);
        batch.update(mainProjectRef, projectData);

        if (projectData.members) {
            const allSubProjectIds = await getAllSubProjectIds(projectId);
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
            // The returned project does not need to be nested here.
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

            // Batch-write all new projects
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
            
            // Find and batch-write all new tasks
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
            if(currentUser?.id) await fetchData(currentUser.id); // Fallback to refetch on error
            throw error;
        }
    };
    
    const deleteProject = async (projectId: string, pathname: string) => {
        if (!currentUser) throw new Error("User not authenticated");

        try {
            const batch = writeBatch(db);

            // Since state might be out of sync, fetch hierarchy from DB
            const getProjectIdsToDelete = async (pId: string): Promise<string[]> => {
                let ids: string[] = [pId];
                const q = query(collection(db, 'projects'), where('parentProjectId', '==', pId));
                const snapshot = await getDocs(q);
                for (const document of snapshot.docs) {
                    ids = ids.concat(await getProjectIdsToDelete(document.id));
                }
                return ids;
            };

            const allProjectIdsToDelete = await getProjectIdsToDelete(projectId);
            
            if (allProjectIdsToDelete.length > 0) {
                 const taskQuery = query(collection(db, 'tasks'), where('projectId', 'in', allProjectIdsToDelete));
                 const taskSnapshots = await getDocs(taskQuery);
                 taskSnapshots.forEach(taskDoc => {
                     batch.delete(taskDoc.ref);
                 });
            }
            
            allProjectIdsToDelete.forEach(pId => {
                batch.delete(doc(db, 'projects', pId));
            });

            await batch.commit();
            await fetchData(currentUser.id);

            if (pathname.startsWith(`/project/${projectId}`)) {
                router.push('/dashboard');
            }
            
        } catch (error) {
            console.error("Error deleting project:", error);
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
        // Local state update is no longer needed, onSnapshot will handle it.

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
        // Local state update is no longer needed, onSnapshot will handle it.
    } catch (error) {
        console.error("Error updating task: ", error);
        // No need to refetch, snapshot listener will handle errors and updates.
    }
  };
  
  const deleteTask = async (taskId: string) => {
    if (!currentUser) throw new Error("User not authenticated");
    
    try {
        await deleteDoc(doc(db, 'tasks', taskId));
        // Local state update is no longer needed, onSnapshot will handle it.
    } catch (error) {
        console.error("Error deleting task: ", error);
        // No need to revert state, onSnapshot is the source of truth.
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
      // The user list will be updated via fetchData on next login or manually.
    } catch (error) {
      console.error("Error creating user: ", error);
      throw error;
    }
  };

  const addTaskStatus = async (status: Omit<TaskStatusOption, 'id'>) => {
    const newOrder = taskStatusOptions.length > 0 ? Math.max(...taskStatusOptions.map(s => s.order)) + 1 : 0;
    await addDoc(collection(db, 'task_statuses'), { ...status, order: newOrder });
    // Status list updates via its own onSnapshot listener.
  };

  const updateTaskStatus = async (statusId: string, statusData: Partial<Omit<TaskStatusOption, 'id'>>) => {
    const statusRef = doc(db, 'task_statuses', statusId);
    await updateDoc(statusRef, statusData);
    // Status list updates via its own onSnapshot listener.
  };

  const deleteTaskStatus = async (statusId: string) => {
    await deleteDoc(doc(db, 'task_statuses', statusId));
    // Status list updates via its own onSnapshot listener.
  };

  const updateTaskStatusOrder = async (statuses: TaskStatusOption[]) => {
    const batch = writeBatch(db);
    statuses.forEach((status, index) => {
      const statusRef = doc(db, 'task_statuses', status.id);
      batch.update(statusRef, { order: index });
    });
    await batch.commit();
    // Status list updates via its own onSnapshot listener.
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
      users, projects, tasks, taskStatusOptions, loading, currentUser, 
      login, logout, addProject, updateProject, getProject, duplicateProject, 
      addTask, updateTask, deleteTask, updateUser, createUser, addTaskStatus, 
      updateTaskStatus, deleteTaskStatus, changePassword, findUserByEmail, 
      deleteProject, setTaskStatusOptions, updateTaskStatusOrder
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