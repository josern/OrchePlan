/**
 * Cached API layer for OrchePlan
 * Wraps API calls with intelligent caching strategies
 */

import {
  getProjects as apiGetProjects,
  getProject as apiGetProject,
  getUsers as apiGetUsers,
  getTasksByProjectIds as apiGetTasksByProjectIds,
  getProjectStatuses as apiGetProjectStatuses,
} from './api';
import {
  cacheManager,
  CacheKeys,
  CacheTTL,
  cachedFetch,
  batchCache,
} from './cache';
import type { Project, User, Task, TaskStatusOption } from './types';

/**
 * Get all projects with caching
 */
export async function getCachedProjects(options: {
  forceRefresh?: boolean;
  staleWhileRevalidate?: boolean;
} = {}): Promise<Project[]> {
  const key = CacheKeys.projects();

  if (options.forceRefresh) {
    cacheManager.invalidate(key);
  }

  return cachedFetch(
    key,
    () => apiGetProjects(),
    {
      ttl: CacheTTL.medium,
      staleWhileRevalidate: options.staleWhileRevalidate ?? true,
    }
  );
}

/**
 * Get single project with caching
 */
export async function getCachedProject(
  projectId: string,
  options: { forceRefresh?: boolean; staleWhileRevalidate?: boolean } = {}
): Promise<Project | null> {
  const key = CacheKeys.project(projectId);

  if (options.forceRefresh) {
    cacheManager.invalidate(key);
  }

  return cachedFetch(
    key,
    () => apiGetProject(projectId),
    {
      ttl: CacheTTL.medium,
      staleWhileRevalidate: options.staleWhileRevalidate ?? true,
    }
  );
}

/**
 * Get users with caching
 */
export async function getCachedUsers(options: {
  forceRefresh?: boolean;
  staleWhileRevalidate?: boolean;
} = {}): Promise<User[]> {
  const key = CacheKeys.users();

  if (options.forceRefresh) {
    cacheManager.invalidate(key);
  }

  return cachedFetch(
    key,
    () => apiGetUsers(),
    {
      ttl: CacheTTL.long, // Users change less frequently
      staleWhileRevalidate: options.staleWhileRevalidate ?? true,
    }
  );
}

/**
 * Get tasks by project IDs with caching
 */
export async function getCachedTasksByProjectIds(
  projectIds: string[],
  options: { forceRefresh?: boolean; staleWhileRevalidate?: boolean } = {}
): Promise<Task[]> {
  const key = CacheKeys.tasks(projectIds);

  if (options.forceRefresh) {
    cacheManager.invalidate(key);
  }

  return cachedFetch(
    key,
    () => apiGetTasksByProjectIds(projectIds),
    {
      ttl: CacheTTL.short, // Tasks change frequently
      staleWhileRevalidate: options.staleWhileRevalidate ?? true,
    }
  );
}

/**
 * Get project statuses with caching
 */
export async function getCachedProjectStatuses(
  projectId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<TaskStatusOption[]> {
  const key = CacheKeys.projectStatuses(projectId);

  if (options.forceRefresh) {
    cacheManager.invalidate(key);
  }

  return cachedFetch(
    key,
    () => apiGetProjectStatuses(projectId),
    {
      ttl: CacheTTL.long, // Statuses change infrequently
    }
  );
}

/**
 * Invalidate caches related to a project
 */
export function invalidateProjectCaches(projectId: string): void {
  batchCache()
    .invalidate(CacheKeys.project(projectId))
    .invalidate(CacheKeys.projectStatuses(projectId))
    .invalidatePattern(new RegExp(`^tasks:project:${projectId}$`))
    .invalidatePattern(new RegExp(`^tasks:projects:.*${projectId}.*`))
    .invalidate(CacheKeys.projects()) // Projects list might include this project
    .execute();
}

/**
 * Invalidate caches related to a task
 */
export function invalidateTaskCaches(task: Task): void {
  batchCache()
    .invalidatePattern(new RegExp(`^tasks:project:${task.projectId}$`))
    .invalidatePattern(new RegExp(`^tasks:projects:.*${task.projectId}.*`))
    .execute();
}

/**
 * Invalidate all project-related caches
 */
export function invalidateAllProjectCaches(): void {
  batchCache()
    .invalidatePattern(/^project:/)
    .invalidatePattern(/^projects:/)
    .invalidatePattern(/^tasks:/)
    .invalidatePattern(/^statuses:/)
    .execute();
}

/**
 * Optimistic cache update for task
 * Updates cache immediately before server confirmation
 */
export function optimisticUpdateTask(updatedTask: Task): void {
  // Update any cached task lists that contain this task
  const projectId = updatedTask.projectId;
  
  // Try to update cached task lists
  const patterns = [
    CacheKeys.projectTasks(projectId),
    new RegExp(`^tasks:projects:.*${projectId}.*`),
  ];

  patterns.forEach(pattern => {
    if (typeof pattern === 'string') {
      const cached = cacheManager.get<Task[]>(pattern);
      if (cached) {
        const updated = cached.map(t => t.id === updatedTask.id ? updatedTask : t);
        cacheManager.set(pattern, updated, { ttl: CacheTTL.short });
      }
    } else {
      // For regex patterns, we need to iterate through cache keys
      // This is less efficient but necessary for pattern matching
      const cacheKeys = Array.from((cacheManager as any).cache.keys()) as string[];
      for (const key of cacheKeys) {
        if (pattern.test(key)) {
          const cached = cacheManager.get<Task[]>(key);
          if (cached) {
            const updated = cached.map(t => t.id === updatedTask.id ? updatedTask : t);
            cacheManager.set(key, updated, { ttl: CacheTTL.short });
          }
        }
      }
    }
  });
}

/**
 * Optimistic cache update for project
 */
export function optimisticUpdateProject(updatedProject: Project): void {
  // Update single project cache
  const key = CacheKeys.project(updatedProject.id);
  cacheManager.set(key, updatedProject, { ttl: CacheTTL.medium });

  // Update projects list cache if it exists
  const projectsKey = CacheKeys.projects();
  const cachedProjects = cacheManager.get<Project[]>(projectsKey);
  if (cachedProjects) {
    const updateProjectInList = (projects: Project[]): Project[] => {
      return projects.map(p => {
        if (p.id === updatedProject.id) {
          return { ...updatedProject, subProjects: p.subProjects };
        }
        if (p.subProjects && p.subProjects.length > 0) {
          return { ...p, subProjects: updateProjectInList(p.subProjects) };
        }
        return p;
      });
    };

    const updated = updateProjectInList(cachedProjects);
    cacheManager.set(projectsKey, updated, { ttl: CacheTTL.medium });
  }
}

/**
 * Prefetch data for better UX
 */
export async function prefetchProjectData(projectId: string): Promise<void> {
  // Prefetch in parallel without blocking
  Promise.all([
    getCachedProject(projectId, { staleWhileRevalidate: true }),
    getCachedProjectStatuses(projectId),
  ]).catch(err => {
    console.warn('[Cache] Prefetch failed:', err);
  });
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats() {
  return cacheManager.getStats();
}

/**
 * Clear all caches (useful for logout or manual refresh)
 */
export function clearAllCaches(): void {
  cacheManager.clear();
}
