import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { CustomerDetail } from '../api/types';

export function useCustomer(id: string) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    api
      .customer(id)
      .then((c) => active && setCustomer(c))
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id]);

  return { customer, error };
}
