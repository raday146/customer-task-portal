import { PrismaClient, TaskStatus } from '@prisma/client';
import { TASK_TITLES, TENANTS } from './seed-data';

/**
 * Adds a large volume of customers and tasks to the first tenant so that
 * list and dashboard behaviour can be observed on a realistic data size.
 * Run `npm run db:seed` first.
 */
const prisma = new PrismaClient();
const CUSTOMERS = 1500;
const TASKS_PER_CUSTOMER = 4;
const DAY = 24 * 60 * 60 * 1000;

const PREFIXES = [
  'North',
  'Blue',
  'Silver',
  'Red',
  'Summit',
  'River',
  'Oak',
  'Prime',
  'Union',
  'Metro',
];
const SUFFIXES = ['Holdings', 'Labs', 'Partners', 'Group', 'Systems', 'Supply', 'Studio', 'Works'];

async function main() {
  const tenant = TENANTS[0];
  const existing = await prisma.customer.count({
    where: { tenantId: tenant.id, email: { endsWith: '@bulk.example' } },
  });
  if (existing > 0) {
    console.log(`Large dataset already present (${existing} bulk customers). Skipping.`);
    return;
  }
  const now = Date.now();
  const statuses: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE'];

  for (let batch = 0; batch < CUSTOMERS; batch += 250) {
    const customers = [];
    for (let i = batch; i < Math.min(batch + 250, CUSTOMERS); i++) {
      customers.push({
        tenantId: tenant.id,
        name: `${PREFIXES[i % PREFIXES.length]} ${SUFFIXES[i % SUFFIXES.length]} ${i + 1}`,
        email: `contact${i + 1}@bulk.example`,
        status: i % 9 === 0 ? ('INACTIVE' as const) : ('ACTIVE' as const),
      });
    }
    const created = await prisma.customer.createManyAndReturn({
      data: customers,
      select: { id: true },
    });
    const tasks = created.flatMap((c, ci) =>
      Array.from({ length: TASKS_PER_CUSTOMER }, (_, k) => ({
        tenantId: tenant.id,
        customerId: c.id,
        assigneeId: tenant.users[(ci + k) % tenant.users.length].id,
        title: TASK_TITLES[(ci + k) % TASK_TITLES.length],
        status: statuses[(ci + k) % statuses.length],
        dueDate: new Date(now + (((ci + k * 13) % 60) - 20) * DAY),
      })),
    );
    await prisma.task.createMany({ data: tasks });
    process.stdout.write('.');
  }
  console.log(
    `\nAdded ${CUSTOMERS} customers and ${CUSTOMERS * TASKS_PER_CUSTOMER} tasks to ${tenant.name}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
