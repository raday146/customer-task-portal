export type Role = 'ADMIN' | 'USER';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenant: { id: string; name: string };
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number };
}

export interface CustomerDetail extends Customer {
  previous: { id: string; name: string } | null;
  next: { id: string; name: string } | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string | null;
  customerId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string };
  assignee?: { id: string; name: string } | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardData {
  customers: number;
  activeCustomers: number;
  openTasks: number;
  completedTasks: number;
  overdueTasks: number;
  topCustomers: { id: string; name: string; openTasks: number; overdueTasks: number }[];
  upcomingTasks: Task[];
}

export interface TaskInput {
  title: string;
  description?: string;
  customerId: string;
  assigneeId?: string | null;
  status?: TaskStatus;
  dueDate?: string | null;
}
