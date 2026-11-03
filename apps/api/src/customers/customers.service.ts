import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Paginated } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { ListCustomersQuery } from './dto/list-customers.query';

const taskInclude = {
  assignee: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: ListCustomersQuery): Promise<Paginated<unknown>> {
    const { search, status, page, pageSize } = query;
    const where: Prisma.CustomerWhereInput = {
      tenantId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { tasks: true } } },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { tasks: true } } },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  /** Neighbouring customers (alphabetical) used for previous/next navigation. */
  async findNeighbours(tenantId: string, name: string) {
    const [previous, next] = await Promise.all([
      this.prisma.customer.findFirst({
        where: { tenantId, name: { lt: name } },
        orderBy: { name: 'desc' },
        select: { id: true, name: true },
      }),
      this.prisma.customer.findFirst({
        where: { tenantId, name: { gt: name } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    ]);
    return { previous, next };
  }

  async findTasks(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.task.findMany({
      where: { customerId, tenantId },
      include: taskInclude,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }
}
