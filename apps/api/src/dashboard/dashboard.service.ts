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
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    const [openGroups, overdueGroups, doneGroups] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['customerId'],
        where: { tenantId, status: { in: OPEN_STATUSES } },
        _count: { _all: true },
        orderBy: { customerId: 'asc' },
      }),
      this.prisma.task.groupBy({
        by: ['customerId'],
        where: { tenantId, status: { in: OPEN_STATUSES }, dueDate: { lt: now } },
        _count: { _all: true },
        orderBy: { customerId: 'asc' },
      }),
      this.prisma.task.groupBy({
        by: ['customerId'],
        where: { tenantId, status: { notIn: OPEN_STATUSES } },
        _count: { _all: true },
        orderBy: { customerId: 'asc' },
      }),
    ]);
    const toMap = (groups: { customerId: string; _count: { _all: number } }[]) =>
      new Map(groups.map((g) => [g.customerId, g._count._all]));
    const openBy = toMap(openGroups);
    const overdueBy = toMap(overdueGroups);
    const doneBy = toMap(doneGroups);

    let openTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;
    const summaries: CustomerSummary[] = [];

    for (const customer of customers) {
      const open = openBy.get(customer.id) ?? 0;
      const overdue = overdueBy.get(customer.id) ?? 0;
      openTasks += open;
      overdueTasks += overdue;
      completedTasks += doneBy.get(customer.id) ?? 0;
      summaries.push({
        id: customer.id,
        name: customer.name,
        openTasks: open,
        overdueTasks: overdue,
      });
    }

    const upcomingTasks = await this.prisma.task.findMany({
      where: { tenantId, status: { in: OPEN_STATUSES } },
      orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
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
