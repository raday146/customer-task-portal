import { PrismaService } from '../src/prisma/prisma.service';
import { TestWorld } from './helpers';

let queries = 0;

class CountingPrisma extends PrismaService {
  constructor() {
    super({ log: [{ emit: 'event', level: 'query' }] });
    (this as unknown as { $on: (e: 'query', cb: () => void) => void }).$on('query', () => {
      queries++;
    });
  }
}

describe('GET /dashboard query count (e2e)', () => {
  let w: TestWorld;

  beforeAll(async () => {
    w = await TestWorld.create(CountingPrisma);
  });
  afterAll(() => w.close());

  const countFor = async (): Promise<number> => {
    const admin = await w.as(w.a.admin); // login runs its own queries; measure only the dashboard call
    queries = 0;
    await admin.get('/api/dashboard').expect(200);
    // Prisma emits query events asynchronously; let them flush.
    await new Promise((r) => setTimeout(r, 100));
    return queries;
  };

  const growTo = async (total: number): Promise<void> => {
    const have = await w.prisma.customer.count({ where: { tenantId: w.a.id } });
    for (let i = have; i < total; i++) {
      const c = await w.makeCustomer(w.a, `qc-${i}`);
      await w.makeTask(w.a, { customerId: c.id, dueDate: new Date(Date.now() + 86400000) });
    }
  };

  it('does not issue more SQL queries when the tenant has 30 customers instead of 3', async () => {
    await growTo(3);
    const small = await countFor();
    await growTo(30);
    const large = await countFor();
    expect({ customers: 30, queries: large }).toEqual({ customers: 30, queries: small });
  });
});
