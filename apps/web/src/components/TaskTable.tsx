import { Link } from 'react-router-dom';
import type { Task } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { DueDate } from './DueDate';
import { StatusBadge } from './StatusBadge';

interface Props {
  tasks: Task[];
  showCustomer?: boolean;
  onEdit?: (task: Task) => void;
  onComplete?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

export function TaskTable({ tasks, showCustomer = true, onEdit, onComplete, onDelete }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Task</th>
          {showCustomer && <th>Customer</th>}
          <th>Assignee</th>
          <th>Status</th>
          <th>Due</th>
          {(onEdit || onComplete || onDelete) && (
            <th className="actions-col" aria-label="Actions" />
          )}
        </tr>
      </thead>
      <tbody>
        {tasks.map((t) => {
          const canEdit = isAdmin || t.assigneeId === user?.id;
          return (
            <tr key={t.id}>
              <td>
                <div className="task-title">{t.title}</div>
                {t.description && <div className="task-desc">{t.description}</div>}
              </td>
              {showCustomer && (
                <td>
                  {t.customer ? (
                    <Link to={`/customers/${t.customer.id}`}>{t.customer.name}</Link>
                  ) : (
                    '—'
                  )}
                </td>
              )}
              <td>{t.assignee?.name ?? <span className="muted">Unassigned</span>}</td>
              <td>
                <StatusBadge status={t.status} />
              </td>
              <td>
                <DueDate value={t.dueDate} status={t.status} />
              </td>
              {(onEdit || onComplete || onDelete) && (
                <td className="actions">
                  {canEdit && onComplete && t.status !== 'DONE' && (
                    <button className="btn btn-small" onClick={() => onComplete(t)}>
                      Complete
                    </button>
                  )}
                  {canEdit && onEdit && (
                    <button className="btn btn-small btn-ghost" onClick={() => onEdit(t)}>
                      Edit
                    </button>
                  )}
                  {isAdmin && onDelete && (
                    <button className="btn btn-small btn-danger-ghost" onClick={() => onDelete(t)}>
                      Delete
                    </button>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
