import { useState } from 'react';
import type { CustomerStatus } from '../api/types';
import { CustomersTable } from '../components/CustomersTable';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, Loading } from '../components/StateViews';
import { useCustomers } from '../hooks/useCustomers';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const PAGE_SIZE = 15;

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CustomerStatus | ''>('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const { data, loading, error } = useCustomers({
    search: debouncedSearch,
    status,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Customers</h1>
          <p className="muted">Search your company&apos;s customer accounts.</p>
        </div>
      </header>

      <section className="card">
        <div className="toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search by name or email"
            aria-label="Search customers"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as CustomerStatus | '');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          {loading && data && <span className="muted small">Updating…</span>}
        </div>

        {error && <ErrorState message={error} />}
        {!data && loading && <Loading />}
        {data && data.items.length === 0 && (
          <EmptyState title="No customers found" hint="Try a different search or filter." />
        )}
        {data && data.items.length > 0 && (
          <>
            <CustomersTable customers={data.items} />
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onChange={setPage}
            />
          </>
        )}
      </section>
    </>
  );
}
