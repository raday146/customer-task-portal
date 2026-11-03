import type {
  Customer,
  CustomerDetail,
  CustomerStatus,
  DashboardData,
  Paginated,
  Task,
  TaskInput,
  TaskStatus,
  TeamMember,
  UserProfile,
} from './types';

const TOKEN_KEY = 'ctp.token';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`/api${path}`, { ...init, headers });

  if (res.status === 401 && token) {
    tokenStore.clear();
    onUnauthorized?.();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(res.status, message || res.statusText || 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export interface CustomerQuery {
  search?: string;
  status?: CustomerStatus | '';
  page?: number;
  pageSize?: number;
}

export interface TaskQuery {
  status?: TaskStatus | '';
  assigneeId?: string;
  page?: number;
  pageSize?: number;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<UserProfile>('/auth/me'),
  users: () => request<TeamMember[]>('/users'),
  dashboard: () => request<DashboardData>('/dashboard'),

  customers: (query: CustomerQuery = {}) =>
    request<Paginated<Customer>>(`/customers${qs({ ...query })}`),
  customer: (id: string) => request<CustomerDetail>(`/customers/${id}`),
  customerTasks: (id: string) => request<Task[]>(`/customers/${id}/tasks`),

  tasks: (query: TaskQuery = {}) => request<Paginated<Task>>(`/tasks${qs({ ...query })}`),
  createTask: (input: TaskInput) =>
    request<Task | { success: false; error: string }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateTask: (id: string, changes: Partial<TaskInput>) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  deleteTask: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
};
