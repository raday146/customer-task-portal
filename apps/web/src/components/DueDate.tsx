import type { TaskStatus } from '../api/types';

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DueDate({ value, status }: { value: string | null; status: TaskStatus }) {
  if (!value) return <span className="muted">No due date</span>;
  const due = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = status !== 'DONE' && due < today;
  const soon = !overdue && status !== 'DONE' && due.getTime() - today.getTime() < 3 * 86400000;
  return (
    <span className={overdue ? 'due due-overdue' : soon ? 'due due-soon' : 'due'}>
      {formatDate(value)}
      {overdue && <span className="due-tag">Overdue</span>}
    </span>
  );
}
