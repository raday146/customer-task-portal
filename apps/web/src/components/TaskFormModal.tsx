import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api/client';
import type { Customer, Task, TaskInput, TaskStatus } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useTeam } from '../hooks/useTeam';
import { useToast } from './Toast';

interface Props {
  task?: Task | null;
  defaultCustomerId?: string;
  onClose: () => void;
  onSaved: (task: Task) => void;
}

function toDateInput(iso: string | null | undefined) {
  return iso ? iso.slice(0, 10) : '';
}

export function TaskFormModal({ task, defaultCustomerId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const team = useTeam();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TaskInput>({
    title: task?.title ?? '',
    description: task?.description ?? '',
    customerId: task?.customerId ?? defaultCustomerId ?? '',
    assigneeId: task ? task.assigneeId : (user?.id ?? null),
    status: task?.status ?? 'OPEN',
    dueDate: toDateInput(task?.dueDate),
  });

  useEffect(() => {
    api
      .customers({ pageSize: 100 })
      .then((r) => setCustomers(r.items))
      .catch(() => setCustomers([]));
  }, []);

  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload: TaskInput = {
      ...form,
      title: form.title.trim(),
      assigneeId: form.assigneeId || null,
      dueDate: form.dueDate || null,
    };
    try {
      if (task) {
        const saved = await api.updateTask(task.id, payload);
        toast('Task updated');
        onSaved(saved);
      } else {
        const created = await api.createTask(payload);
        toast('Task created');
        onSaved(created);
      }
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-form-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="task-form-title">{task ? 'Edit task' : 'New task'}</h2>
        <form onSubmit={submit} className="form">
          <label>
            Title
            <input
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              autoFocus
            />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </label>
          <div className="form-row">
            <label>
              Customer
              <select
                required
                value={form.customerId}
                onChange={(e) => set('customerId', e.target.value)}
              >
                <option value="" disabled>
                  Select a customer
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assignee
              <select
                value={form.assigneeId ?? ''}
                onChange={(e) => set('assigneeId', e.target.value || null)}
              >
                <option value="">Unassigned</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value as TaskStatus)}
              >
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="DONE">Done</option>
              </select>
            </label>
            <label>
              Due date
              <input
                type="date"
                value={form.dueDate ?? ''}
                onChange={(e) => set('dueDate', e.target.value)}
              />
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : task ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
