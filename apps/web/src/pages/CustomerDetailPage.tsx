import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDate } from '../components/DueDate';
import { EmptyState, ErrorState, Loading } from '../components/StateViews';
import { StatusBadge } from '../components/StatusBadge';
import { TaskFormModal } from '../components/TaskFormModal';
import { TaskTable } from '../components/TaskTable';
import { useCustomer } from '../hooks/useCustomer';
import { useCustomerTasks } from '../hooks/useCustomerTasks';
import type { Task } from '../api/types';
import { api } from '../api/client';
import { useToast } from '../components/Toast';

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const { customer, error } = useCustomer(id);
  const { tasks, loading, error: tasksError, reload } = useCustomerTasks(id);
  const [editing, setEditing] = useState<Task | null | undefined>(undefined);
  const toast = useToast();

  async function complete(task: Task) {
    try {
      await api.updateTask(task.id, { status: 'DONE' });
      toast(`"${task.title}" marked as done`);
      reload();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!customer) return <Loading />;

  return (
    <>
      <nav className="breadcrumbs">
        <Link to="/customers">Customers</Link> <span>/</span> <span>{customer.name}</span>
      </nav>
      <header className="page-header">
        <div>
          <h1>
            {customer.name} <StatusBadge status={customer.status} />
          </h1>
          <p className="muted">
            {customer.email} · Customer since {formatDate(customer.createdAt)}
          </p>
        </div>
        <div className="header-actions">
          <div className="pager">
            {customer.previous ? (
              <Link
                className="btn btn-ghost"
                to={`/customers/${customer.previous.id}`}
                title={customer.previous.name}
              >
                ← Previous
              </Link>
            ) : (
              <span className="btn btn-ghost disabled">← Previous</span>
            )}
            {customer.next ? (
              <Link
                className="btn btn-ghost"
                to={`/customers/${customer.next.id}`}
                title={customer.next.name}
              >
                Next →
              </Link>
            ) : (
              <span className="btn btn-ghost disabled">Next →</span>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => setEditing(null)}>
            New task
          </button>
        </div>
      </header>

      <section className="card">
        <div className="card-header">
          <h2>Tasks</h2>
          <span className="muted small">{tasks.length} total</span>
        </div>
        {tasksError && <ErrorState message={tasksError} />}
        {loading && tasks.length === 0 && <Loading />}
        {!loading && tasks.length === 0 && !tasksError && (
          <EmptyState title="No tasks yet" hint="Create the first task for this customer." />
        )}
        {tasks.length > 0 && (
          <TaskTable tasks={tasks} showCustomer={false} onEdit={setEditing} onComplete={complete} />
        )}
      </section>

      {editing !== undefined && (
        <TaskFormModal
          task={editing}
          defaultCustomerId={customer.id}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            reload();
          }}
        />
      )}
    </>
  );
}
