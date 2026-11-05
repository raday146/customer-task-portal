import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser, Paginated } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQuery } from './dto/list-tasks.query';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskRuleError } from './task-rule.error';

const taskInclude = {
  assignee: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUser, query: ListTasksQuery): Promise<Paginated<unknown>> {
    const { status, assigneeId, page, pageSize } = query;
    const where: Prisma.TaskWhereInput = {
      tenantId: user.tenantId,
      ...(status ? { status } : {}),
      ...(assigneeId ? { assigneeId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async create(user: AuthUser, dto: CreateTaskDto) {
    const referenceError = await this.findReferenceError(user.tenantId, dto);
    if (referenceError) throw new TaskRuleError(referenceError);

    if (dto.dueDate && new Date(dto.dueDate) < startOfToday()) {
      throw new TaskRuleError('Due date cannot be in the past');
    }

    return this.prisma.task.create({
      data: {
        tenantId: user.tenantId,
        customerId: dto.customerId,
        assigneeId: dto.assigneeId ?? null,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? '',
        status: dto.status ?? 'OPEN',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      include: taskInclude,
    });
  }

  async update(user: AuthUser, id: string, changes: UpdateTaskDto) {
    const existing = await this.prisma.task.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true, assigneeId: true, dueDate: true },
    });
    if (!existing) throw new NotFoundException('Task not found');

    if (user.role !== 'ADMIN') {
      const reassigns =
        changes.assigneeId !== undefined && changes.assigneeId !== existing.assigneeId;
      if (existing.assigneeId !== user.id || reassigns) {
        throw new ForbiddenException('You do not have permission to change this task');
      }
    }

    const referenceError = await this.findReferenceError(user.tenantId, changes);
    if (referenceError) throw new BadRequestException(referenceError);

    const storedDay = existing.dueDate?.toISOString().slice(0, 10);
    if (
      changes.dueDate &&
      changes.dueDate.slice(0, 10) !== storedDay &&
      new Date(changes.dueDate) < startOfToday()
    ) {
      throw new TaskRuleError('Due date cannot be in the past');
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        title: changes.title ?? undefined,
        description: changes.description ?? undefined,
        customerId: changes.customerId ?? undefined,
        assigneeId: changes.assigneeId,
        status: changes.status ?? undefined,
        dueDate:
          changes.dueDate === undefined ? undefined : changes.dueDate && new Date(changes.dueDate),
      },
      include: taskInclude,
    });
  }

  /** Returns a message when a referenced customer/assignee is not in the caller's tenant. */
  private async findReferenceError(
    tenantId: string,
    refs: { customerId?: string | null; assigneeId?: string | null },
  ): Promise<string | null> {
    if (refs.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: refs.customerId, tenantId },
        select: { id: true },
      });
      if (!customer) return 'Customer does not exist';
    }
    if (refs.assigneeId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: refs.assigneeId, tenantId },
        select: { id: true },
      });
      if (!assignee) return 'Assignee must be a member of your company';
    }
    return null;
  }

  async remove(user: AuthUser, id: string) {
    const { count } = await this.prisma.task.deleteMany({ where: { id, tenantId: user.tenantId } });
    if (count === 0) throw new NotFoundException('Task not found');
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
