import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  tenantId: string;
  role: Role;
  email: string;
  name: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
