import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Task } from '../api/types';

export function useCustomerTasks(customerId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await api.customerTasks(customerId));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { tasks, loading, error, reload };
}
