import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Paginated, Task, TaskStatus } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, Loading } from '../components/StateViews';
import { TaskFormModal } from '../components/TaskFormModal';
import { TaskTable } from '../components/TaskTable';
import { useToast } from '../components/Toast';
import { useTeam } from '../hooks/useTeam';

export function TasksPage() {
  const { user } = useAuth();
  const team = useTeam();
  const toast = useToast();
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [assigneeId, setAssigneeId] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Task> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | null | undefined>(undefined);

  const load = useCallback(() => {
    setError(null);
    return api
      .tasks({ status, assigneeId: assigneeId || undefined, page })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [status, assigneeId, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function complete(task: Task) {
    try {
      await api.updateTask(task.id, { status: 'DONE' });
      toast(`"${task.title}" marked as done`);
      load();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  async function remove(task: Task) {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    try {
      await api.deleteTask(task.id);
      toast('Task deleted');
      load();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Tasks</h1>
          <p className="muted">Track work across all of your customers.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing(null)}>
          New task
        </button>
      </header>

      <section className="card">
        <div className="toolbar">
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as TaskStatus | '');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="DONE">Done</option>
          </select>
          <select
            aria-label="Filter by assignee"
            value={assigneeId}
            onChange={(e) => {
              setAssigneeId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Everyone</option>
            {user && <option value={user.id}>Assigned to me</option>}
            {team
              .filter((m) => m.id !== user?.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </div>

        {error && <ErrorState message={error} />}
        {!data && !error && <Loading />}
        {data && data.items.length === 0 && <EmptyState title="No tasks match these filters" />}
        {data && data.items.length > 0 && (
          <>
            <TaskTable
              tasks={data.items}
              onEdit={setEditing}
              onComplete={complete}
              onDelete={remove}
            />
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onChange={setPage}
            />
          </>
        )}
      </section>

      {editing !== undefined && (
        <TaskFormModal
          task={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            load();
          }}
        />
      )}
    </>
  );
}
