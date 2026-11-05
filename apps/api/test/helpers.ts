import { INestApplication, Logger } from '@nestjs/common';
import { Role, Task, TaskStatus } from '@prisma/client';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

export const PASSWORD = 'DemoPass123!';

export interface TestUser {
  id: string;
  email: string;
}

export interface TestTenant {
  id: string;
  admin: TestUser;
  alice: TestUser;
  bob: TestUser;
  customer: { id: string; name: string };
  otherCustomer: { id: string; name: string };
}

/**
 * Self-contained e2e world: two fresh tenants with their own users, customers and
 * tasks. Nothing depends on (or alters) the seeded demo rows; everything is removed
 * in `close()`.
 */
export class TestWorld {
  private constructor(
    readonly app: INestApplication,
    readonly prisma: PrismaService,
    readonly a: TestTenant,
    readonly b: TestTenant,
  ) {}

  static async create(): Promise<TestWorld> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = configureApp(moduleRef.createNestApplication({ logger: false }));
    Logger.overrideLogger(false);
    await app.init();
    const prisma = app.get(PrismaService);
    const passwordHash = bcrypt.hashSync(PASSWORD, 4);
    const a = await seedTenant(prisma, passwordHash, 'a');
    const b = await seedTenant(prisma, passwordHash, 'b');
    return new TestWorld(app, prisma, a, b);
  }

  async close(): Promise<void> {
    const ids = [this.a.id, this.b.id];
    await this.prisma.task.deleteMany({ where: { tenantId: { in: ids } } });
    await this.prisma.customer.deleteMany({ where: { tenantId: { in: ids } } });
    await this.prisma.user.deleteMany({ where: { tenantId: { in: ids } } });
    await this.prisma.tenant.deleteMany({ where: { id: { in: ids } } });
    await this.app.close();
  }

  async login(user: TestUser): Promise<string> {
    const res = await request(this.app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(200);
    return res.body.accessToken as string;
  }

  /** Authenticated supertest agent helpers for `user`. */
  async as(user: TestUser) {
    const token = await this.login(user);
    const server = this.app.getHttpServer();
    const auth = { Authorization: `Bearer ${token}` };
    return {
      get: (url: string) => request(server).get(url).set(auth),
      post: (url: string) => request(server).post(url).set(auth),
      patch: (url: string) => request(server).patch(url).set(auth),
      delete: (url: string) => request(server).delete(url).set(auth),
    };
  }

  makeTask(
    tenant: TestTenant,
    data: { assigneeId?: string | null; customerId?: string; status?: TaskStatus; title?: string } = {},
  ): Promise<Task> {
    return this.prisma.task.create({
      data: {
        tenantId: tenant.id,
        customerId: data.customerId ?? tenant.customer.id,
        assigneeId: data.assigneeId === undefined ? null : data.assigneeId,
        title: data.title ?? `task-${randomUUID().slice(0, 8)}`,
        status: data.status ?? 'OPEN',
      },
    });
  }

  getTask(id: string): Promise<Task | null> {
    return this.prisma.task.findUnique({ where: { id } });
  }
}

async function seedTenant(
  prisma: PrismaService,
  passwordHash: string,
  label: string,
): Promise<TestTenant> {
  const tag = randomUUID().slice(0, 8);
  const tenant = await prisma.tenant.create({ data: { name: `e2e-${label}-${tag}` } });
  const mkUser = async (name: string, role: Role): Promise<TestUser> => {
    const email = `${name}-${label}-${tag}@e2e.test`;
    const u = await prisma.user.create({
      data: { tenantId: tenant.id, name, email, passwordHash, role },
    });
    return { id: u.id, email };
  };
  const mkCustomer = (name: string) =>
    prisma.customer.create({
      data: { tenantId: tenant.id, name: `${name}-${tag}`, email: `${name}-${tag}@cust.test` },
      select: { id: true, name: true },
    });
  return {
    id: tenant.id,
    admin: await mkUser('admin', 'ADMIN'),
    alice: await mkUser('alice', 'USER'),
    bob: await mkUser('bob', 'USER'),
    customer: await mkCustomer('mid'),
    otherCustomer: await mkCustomer('zeta'),
  };
}
