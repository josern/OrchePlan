// A simple async data-fetching hook.
// NOTE: This is not a full-featured data-fetching library,
// but it's a good starting point for this scaffold.
// For a more robust solution, consider using a library like
// React Query or SWR.
'use client';
import { useState, useEffect, useCallback } from 'react';

interface UseQueryOptions<T> {
  queryKey: (string | number | undefined)[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
}

export function useQuery<T>({ queryKey, queryFn, enabled = true }: UseQueryOptions<T>) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const executeQuery = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await queryFn();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('Error in useQuery:', err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...queryKey]); // Use queryKey in dependency array

  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  return { data, loading, error };
}
