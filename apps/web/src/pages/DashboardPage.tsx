import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { DashboardData } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { DueDate } from '../components/DueDate';
import { EmptyState, ErrorState, Loading } from '../components/StateViews';
import { StatusBadge } from '../components/StatusBadge';

function Metric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`metric ${tone ? `metric-${tone}` : ''}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .dashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Good to see you, {user?.name.split(' ')[0]}</h1>
          <p className="muted">Here is what is happening at {user?.tenant.name}.</p>
        </div>
      </header>

      {error && <ErrorState message={error} />}
      {!data && !error && <Loading />}
      {data && (
        <>
          <section className="metrics">
            <Metric label="Customers" value={data.customers} />
            <Metric label="Open tasks" value={data.openTasks} tone="info" />
            <Metric label="Completed tasks" value={data.completedTasks} tone="success" />
            <Metric label="Overdue tasks" value={data.overdueTasks} tone="danger" />
          </section>

          <div className="grid-2">
            <section className="card">
              <div className="card-header">
                <h2>Upcoming work</h2>
                <Link to="/tasks">View all tasks</Link>
              </div>
              {data.upcomingTasks.length === 0 ? (
                <EmptyState title="Nothing open" hint="All caught up." />
              ) : (
                <ul className="list">
                  {data.upcomingTasks.map((t) => (
                    <li key={t.id} className="list-row">
                      <div>
                        <div className="task-title">{t.title}</div>
                        <div className="muted small">
                          {t.customer?.name} · {t.assignee?.name ?? 'Unassigned'}
                        </div>
                      </div>
                      <div className="list-meta">
                        <StatusBadge status={t.status} />
                        <DueDate value={t.dueDate} status={t.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <div className="card-header">
                <h2>Customers needing attention</h2>
                <Link to="/customers">All customers</Link>
              </div>
              {data.topCustomers.length === 0 ? (
                <EmptyState title="No open work" />
              ) : (
                <table className="table table-compact">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th className="num">Open</th>
                      <th className="num">Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCustomers.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link to={`/customers/${c.id}`}>{c.name}</Link>
                        </td>
                        <td className="num">{c.openTasks}</td>
                        <td className={`num ${c.overdueTasks ? 'text-danger' : ''}`}>
                          {c.overdueTasks}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
