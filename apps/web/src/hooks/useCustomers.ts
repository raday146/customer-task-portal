import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { CustomerQuery } from '../api/client';
import type { Customer, Paginated } from '../api/types';

export function useCustomers(query: CustomerQuery) {
  const [data, setData] = useState<Paginated<Customer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .customers(query)
      .then((result) => setData(result))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.search, query.status, query.page, query.pageSize]);

  return { data, loading, error };
}
