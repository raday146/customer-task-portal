import type { CustomerStatus, TaskStatus } from '../api/types';

const LABELS: Record<TaskStatus | CustomerStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

export function StatusBadge({ status }: { status: TaskStatus | CustomerStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{LABELS[status]}</span>;
}
