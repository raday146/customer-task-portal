import { PrismaClient, TaskStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DEMO_PASSWORD, TASK_DESCRIPTIONS, TASK_TITLES, TENANTS } from './seed-data';

const prisma = new PrismaClient();

// Due dates are computed relative to the day the seed runs, so overdue counts stay meaningful.
const DAY = 24 * 60 * 60 * 1000;

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

function fixtureId(tenantIndex: number, kind: '1000' | '2000', i: number): string {
  return `${tenantIndex === 0 ? '6f1c2a10' : '7a2d3b20'}-${kind}-4000-8000-${String(i + 1).padStart(12, '0')}`;
}

async function main() {
  console.log('Resetting demo data...');
  await prisma.task.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const today = startOfToday();
  let taskCount = 0;

  for (const [tIndex, tenant] of TENANTS.entries()) {
    await prisma.tenant.create({ data: { id: tenant.id, name: tenant.name } });
    await prisma.user.createMany({
      data: tenant.users.map((u) => ({ ...u, tenantId: tenant.id, passwordHash })),
    });

    const customers = tenant.customers.map((c, i) => ({
      id: fixtureId(tIndex, '1000', i),
      tenantId: tenant.id,
      ...c,
      createdAt: new Date(today.getTime() - (90 - i * 5) * DAY),
    }));
    await prisma.customer.createMany({ data: customers });

    const statuses: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE', 'OPEN', 'DONE'];
    const tasks = [];
    const perTenant = tIndex === 0 ? 60 : 50;
    for (let i = 0; i < perTenant; i++) {
      const customer = customers[(i * 7) % customers.length];
      const status = statuses[i % statuses.length];
      // Spread due dates from 20 days ago to 40 days ahead; a few open tasks end up overdue.
      const offset = ((i * 11) % 60) - 20;
      const assignee = i % 6 === 5 ? null : tenant.users[i % tenant.users.length];
      tasks.push({
        id: fixtureId(tIndex, '2000', i),
        tenantId: tenant.id,
        customerId: customer.id,
        assigneeId: assignee?.id ?? null,
        title: TASK_TITLES[(i + tIndex * 3) % TASK_TITLES.length],
        description: TASK_DESCRIPTIONS[i % TASK_DESCRIPTIONS.length],
        status,
        dueDate: new Date(today.getTime() + offset * DAY),
        createdAt: new Date(today.getTime() - (30 - (i % 30)) * DAY),
      });
    }
    await prisma.task.createMany({ data: tasks });
    taskCount += tasks.length;
  }

  console.log(
    `Seeded ${TENANTS.length} tenants, ${TENANTS.reduce((n, t) => n + t.users.length, 0)} users, ` +
      `${TENANTS.reduce((n, t) => n + t.customers.length, 0)} customers, ${taskCount} tasks.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
