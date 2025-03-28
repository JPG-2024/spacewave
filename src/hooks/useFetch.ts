import { useState, useEffect, useCallback } from 'react';

interface UseFetchResult<T> {
  data: T | null;
  isloading: boolean;
  error: Error | null;
  refetch: (newParams?: P) => Promise<void>;
}

export function useFetch<T, P>(
  fetcher: (params: P) => Promise<T>,
  initialParams: P,
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isloading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [params, setParams] = useState<P>(initialParams);

  const fetchData = useCallback(
    async (parameters: P) => {
      try {
        setIsLoading(true);
        const result = await fetcher(parameters);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e : new Error('An error occurred'));
      } finally {
        setIsLoading(false);
      }
    },
    [fetcher],
  );

  const refetch = useCallback(
    async (newParams?: P) => {
      if (newParams) {
        setParams(newParams);
      }
      await fetchData(newParams ?? params);
    },
    [fetchData, params],
  );

  useEffect(() => {
    fetchData(params);
  }, [fetchData, params]);

  return { data, isloading, error, refetch };
}
