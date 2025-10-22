/**
 * Advanced caching system for OrchePlan
 * Implements in-memory caching with TTL, versioning, and smart invalidation
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
  expiresAt: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  version?: number; // Cache version for invalidation
  staleWhileRevalidate?: boolean; // Return stale data while fetching fresh
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class CacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private stats: { hits: number; misses: number };
  private defaultTTL: number;
  private maxSize: number;
  private currentVersion: number;

  constructor(defaultTTL: number = 5 * 60 * 1000, maxSize: number = 1000) {
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0 };
    this.defaultTTL = defaultTTL; // 5 minutes default
    this.maxSize = maxSize;
    this.currentVersion = 1;

    // Periodic cleanup of expired entries
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanup(), 60 * 1000); // Every minute
    }
  }

  /**
   * Get item from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Check version
    if (entry.version !== this.currentVersion) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Check if cache has valid entry
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt || entry.version !== this.currentVersion) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Check if entry is stale but still exists
   */
  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() > entry.expiresAt;
  }

  /**
   * Set item in cache
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    // Enforce max size with LRU eviction
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const ttl = options.ttl ?? this.defaultTTL;
    const version = options.version ?? this.currentVersion;

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version,
      expiresAt: Date.now() + ttl,
    };

    this.cache.set(key, entry);
  }

  /**
   * Invalidate specific cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    this.cache.clear();
    this.currentVersion++;
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt || entry.version !== this.currentVersion) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));

    if (expiredKeys.length > 0) {
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Clear all cache and stats
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

// Cache key builders for consistency
export const CacheKeys = {
  projects: () => 'projects:all',
  project: (id: string) => `project:${id}`,
  projectTasks: (projectId: string) => `tasks:project:${projectId}`,
  projectsByIds: (ids: string[]) => `projects:ids:${ids.sort().join(',')}`,
  tasks: (projectIds: string[]) => `tasks:projects:${projectIds.sort().join(',')}`,
  tasksByIds: (ids: string[]) => `tasks:ids:${ids.sort().join(',')}`,
  users: () => 'users:all',
  user: (id: string) => `user:${id}`,
  projectStatuses: (projectId: string) => `statuses:project:${projectId}`,
};

// Cache TTL presets (in milliseconds)
export const CacheTTL = {
  short: 30 * 1000, // 30 seconds - for frequently changing data
  medium: 5 * 60 * 1000, // 5 minutes - default for most data
  long: 15 * 60 * 1000, // 15 minutes - for relatively stable data
  veryLong: 60 * 60 * 1000, // 1 hour - for very stable data
};

/**
 * Cached fetch wrapper with stale-while-revalidate support
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const cached = cacheManager.get<T>(key);

  // Fresh cache hit
  if (cached !== null && !cacheManager.isStale(key)) {
    return cached;
  }

  // Stale-while-revalidate: return stale data and fetch in background
  if (options.staleWhileRevalidate && cached !== null) {
    // Return stale data immediately
    const staleData = cached;
    
    // Fetch fresh data in background
    fetcher()
      .then(freshData => {
        cacheManager.set(key, freshData, options);
      })
      .catch(err => {
        console.warn('[Cache] Background revalidation failed:', err);
      });

    return staleData;
  }

  // Cache miss or expired: fetch fresh data
  try {
    const data = await fetcher();
    cacheManager.set(key, data, options);
    return data;
  } catch (error) {
    // If fetch fails but we have stale data, return it as fallback
    if (cached !== null) {
      console.warn('[Cache] Fetch failed, returning stale data:', error);
      return cached;
    }
    throw error;
  }
}

/**
 * Batch cache operations
 */
export class BatchCacheOperation {
  private operations: Array<() => void> = [];

  invalidate(key: string): this {
    this.operations.push(() => cacheManager.invalidate(key));
    return this;
  }

  invalidatePattern(pattern: string | RegExp): this {
    this.operations.push(() => cacheManager.invalidatePattern(pattern));
    return this;
  }

  set<T>(key: string, data: T, options?: CacheOptions): this {
    this.operations.push(() => cacheManager.set(key, data, options));
    return this;
  }

  execute(): void {
    this.operations.forEach(op => op());
    this.operations = [];
  }
}

export function batchCache(): BatchCacheOperation {
  return new BatchCacheOperation();
}
