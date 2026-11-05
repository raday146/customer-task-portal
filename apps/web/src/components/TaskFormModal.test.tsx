import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { Task } from '../api/types';
import { demoUser, mockApi } from '../test/utils';
import { ToastProvider } from './Toast';
import { TaskFormModal } from './TaskFormModal';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: demoUser, loading: false, login: vi.fn(), logout: vi.fn() }),
}));

const team = [
  { id: 'u-1', name: 'Olivia Hart', email: 'a@x.test', role: 'ADMIN' },
  { id: 'u-2', name: 'Ben Park', email: 'b@x.test', role: 'MEMBER' },
];
const customers = {
  items: [{ id: 'c-1', name: 'Acme', email: 'a@acme.test', status: 'ACTIVE' }],
};

const baseTask: Task = {
  id: 't-1',
  title: 'Existing task',
  description: '',
  status: 'OPEN',
  dueDate: null,
  customerId: 'c-1',
  assigneeId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function setup(task?: Task) {
  const fetchMock = mockApi({
    'GET /users': team,
    'GET /customers': customers,
    'PATCH /tasks/t-1': { ...baseTask },
    'POST /tasks': { ...baseTask, id: 't-new' },
  });
  render(
    <ToastProvider>
      <TaskFormModal task={task} onClose={vi.fn()} onSaved={vi.fn()} />
    </ToastProvider>,
  );
  return fetchMock;
}

async function submitAndGetBody(fetchMock: ReturnType<typeof mockApi>, method: string) {
  await userEvent.click(screen.getByRole('button', { name: /save changes|create task/i }));
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === method)).toBe(true),
  );
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === method)!;
  return JSON.parse(String(call[1]?.body));
}

describe('TaskFormModal assignee', () => {
  it('keeps an unassigned task unassigned when editing', async () => {
    const fetchMock = setup({ ...baseTask, assigneeId: null });
    await screen.findByRole('option', { name: 'Ben Park' });
    const body = await submitAndGetBody(fetchMock, 'PATCH');
    expect(body.assigneeId).toBeNull();
  });

  it('keeps the existing assignee when editing an assigned task', async () => {
    const fetchMock = setup({ ...baseTask, assigneeId: 'u-2' });
    await screen.findByRole('option', { name: 'Ben Park' });
    const body = await submitAndGetBody(fetchMock, 'PATCH');
    expect(body.assigneeId).toBe('u-2');
  });

  it('defaults a new task to the current user', async () => {
    const fetchMock = setup(undefined);
    await screen.findByRole('option', { name: 'Ben Park' });
    await userEvent.type(screen.getByLabelText('Title'), 'New one');
    await userEvent.selectOptions(screen.getByLabelText('Customer'), 'c-1');
    const body = await submitAndGetBody(fetchMock, 'POST');
    expect(body.assigneeId).toBe('u-1');
  });
});

describe('TaskFormModal create failure', () => {
  it('shows the server message and keeps the modal open', async () => {
    const onSaved = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input), 'http://localhost').pathname;
        if (init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              statusCode: 400,
              error: 'Bad Request',
              message: 'Due date cannot be in the past',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          );
        }
        const body = path.endsWith('/users') ? team : customers;
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );
    render(
      <ToastProvider>
        <TaskFormModal onClose={vi.fn()} onSaved={onSaved} />
      </ToastProvider>,
    );
    await screen.findByRole('option', { name: 'Ben Park' });
    await userEvent.type(screen.getByLabelText('Title'), 'New one');
    await userEvent.selectOptions(screen.getByLabelText('Customer'), 'c-1');
    await userEvent.click(screen.getByRole('button', { name: 'Create task' }));

    expect(await screen.findByText('Due date cannot be in the past')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
