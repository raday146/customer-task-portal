import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Smoke tests against the seeded development database.
 * Requires `docker compose up -d`, `npm run db:migrate` and `npm run db:seed`.
 */
describe('API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  const createdTaskIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication({ logger: false }));
    Logger.overrideLogger(false);
    await app.init();
    prisma = app.get(PrismaService);

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@northstar.test', password: 'DemoPass123!' })
      .expect(200);
    adminToken = res.body.accessToken;
  });

  afterAll(async () => {
    if (createdTaskIds.length)
      await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });

  describe('auth', () => {
    it('logs in with demo credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'priya@bluebird.test', password: 'DemoPass123!' })
        .expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ role: 'USER', tenant: { name: 'Bluebird Logistics' } });
    });

    it('rejects an incorrect password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@northstar.test', password: 'not-the-password' })
        .expect(401);
    });

    it('returns the current user', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/me').set(auth()).expect(200);
      expect(res.body).toMatchObject({ email: 'admin@northstar.test', role: 'ADMIN' });
    });

    it('requires a token for protected routes', async () => {
      await request(app.getHttpServer()).get('/api/customers').expect(401);
    });
  });

  describe('customers', () => {
    it("lists the user's own customers", async () => {
      const res = await request(app.getHttpServer()).get('/api/customers').set(auth()).expect(200);
      expect(res.body.total).toBeGreaterThan(0);
      const names = res.body.items.map((c: { name: string }) => c.name);
      expect(names).toContain('Acme Robotics');
      expect(names).not.toContain('Atlas Freight Forwarding');
    });

    it('supports search and status filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/customers')
        .query({ search: 'acme', status: 'ACTIVE' })
        .set(auth())
        .expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].name).toBe('Acme Robotics');
    });
  });

  describe('tasks', () => {
    it('lets an admin create a task that shows up on the customer and dashboard', async () => {
      const customers = await request(app.getHttpServer())
        .get('/api/customers')
        .query({ search: 'Lumen Solar' })
        .set(auth())
        .expect(200);
      const customerId = customers.body.items[0].id;

      const before = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set(auth())
        .expect(200);

      const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const created = await request(app.getHttpServer())
        .post('/api/tasks')
        .set(auth())
        .send({ title: 'E2E: prepare onboarding pack', customerId, dueDate: due })
        .expect(201);
      createdTaskIds.push(created.body.id);
      expect(created.body).toMatchObject({
        title: 'E2E: prepare onboarding pack',
        status: 'OPEN',
        customerId,
      });

      const customerTasks = await request(app.getHttpServer())
        .get(`/api/customers/${customerId}/tasks`)
        .set(auth())
        .expect(200);
      expect(customerTasks.body.map((t: { id: string }) => t.id)).toContain(created.body.id);

      const after = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set(auth())
        .expect(200);
      expect(after.body.openTasks).toBe(before.body.openTasks + 1);
    });

    it('lets an admin complete a task', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/tasks')
        .query({ status: 'OPEN', pageSize: 1 })
        .set(auth())
        .expect(200);
      const task = list.body.items[0];

      const res = await request(app.getHttpServer())
        .patch(`/api/tasks/${task.id}`)
        .set(auth())
        .send({ status: 'DONE' })
        .expect(200);
      expect(res.body.status).toBe('DONE');

      await prisma.task.update({ where: { id: task.id }, data: { status: 'OPEN' } });
    });
  });
});
