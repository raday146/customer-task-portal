import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CustomerSummary {
  id: string;
  name: string;
  openTasks: number;
  overdueTasks: number;
}

export interface DashboardMetrics {
  customers: number;
  activeCustomers: number;
  openTasks: number;
  completedTasks: number;
  overdueTasks: number;
  topCustomers: CustomerSummary[];
  upcomingTasks: unknown[];
}

const OPEN_STATUSES: TaskStatus[] = ['OPEN', 'IN_PROGRESS'];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(tenantId: string): Promise<DashboardMetrics> {
    const now = new Date();
    const customers = await this.prisma.customer.findMany({
      where: { tenantId },
      select: { id: true, name: true, status: true },
      orderBy: { name: 'asc' },
    });

    let openTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;
    const summaries: CustomerSummary[] = [];

    for (const customer of customers) {
      const tasks = await this.prisma.task.findMany({
        where: { customerId: customer.id },
        select: { status: true, dueDate: true },
      });

      const open = tasks.filter((t) => OPEN_STATUSES.includes(t.status));
      const overdue = open.filter((t) => t.dueDate && t.dueDate < now);

      openTasks += open.length;
      overdueTasks += overdue.length;
      completedTasks += tasks.length - open.length;
      summaries.push({
        id: customer.id,
        name: customer.name,
        openTasks: open.length,
        overdueTasks: overdue.length,
      });
    }

    const upcomingTasks = await this.prisma.task.findMany({
      where: { tenantId, status: { in: OPEN_STATUSES } },
      orderBy: { dueDate: { sort: 'asc', nulls: 'last' } },
      take: 8,
      include: {
        customer: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    return {
      customers: customers.length,
      activeCustomers: customers.filter((c) => c.status === 'ACTIVE').length,
      openTasks,
      completedTasks,
      overdueTasks,
      topCustomers: summaries
        .filter((s) => s.openTasks > 0)
        .sort((a, b) => b.openTasks - a.openTasks || b.overdueTasks - a.overdueTasks)
        .slice(0, 5),
      upcomingTasks,
    };
  }
}
