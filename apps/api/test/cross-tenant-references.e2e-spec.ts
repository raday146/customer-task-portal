import { TestWorld } from './helpers';

describe('S2 cross-tenant references and mass assignment (e2e)', () => {
  let w: TestWorld;

  beforeAll(async () => {
    w = await TestWorld.create();
  });
  afterAll(() => w.close());

  describe('PATCH /tasks/:id', () => {
    it('rejects a customerId from another tenant and leaves the task unchanged', async () => {
      const task = await w.makeTask(w.a);
      const admin = await w.as(w.a.admin);
      const res = await admin.patch(`/api/tasks/${task.id}`).send({ customerId: w.b.customer.id });
      expect([400, 404]).toContain(res.status);
      expect((await w.getTask(task.id))?.customerId).toBe(w.a.customer.id);
    });

    it('rejects an assigneeId from another tenant and leaves the task unchanged', async () => {
      const task = await w.makeTask(w.a);
      const admin = await w.as(w.a.admin);
      const res = await admin.patch(`/api/tasks/${task.id}`).send({ assigneeId: w.b.alice.id });
      expect([400, 404]).toContain(res.status);
      expect((await w.getTask(task.id))?.assigneeId).toBeNull();
    });

    it('accepts a same-tenant customerId and assigneeId', async () => {
      const task = await w.makeTask(w.a);
      const admin = await w.as(w.a.admin);
      const res = await admin
        .patch(`/api/tasks/${task.id}`)
        .send({ customerId: w.a.otherCustomer.id, assigneeId: w.a.alice.id })
        .expect(200);
      expect(res.body).toMatchObject({
        customerId: w.a.otherCustomer.id,
        assigneeId: w.a.alice.id,
        tenantId: w.a.id,
      });
    });

    it('allows unassigning with a null assigneeId', async () => {
      const task = await w.makeTask(w.a, { assigneeId: w.a.alice.id });
      const admin = await w.as(w.a.admin);
      await admin.patch(`/api/tasks/${task.id}`).send({ assigneeId: null }).expect(200);
      expect((await w.getTask(task.id))?.assigneeId).toBeNull();
    });

    it.each(['tenantId', 'createdById', 'role', 'id'])(
      'rejects %s in the body and leaves the task unchanged',
      async (field) => {
        const task = await w.makeTask(w.a);
        const admin = await w.as(w.a.admin);
        await admin
          .patch(`/api/tasks/${task.id}`)
          .send({ title: 'sneaky', [field]: w.b.id })
          .expect(400);
        const after = await w.getTask(task.id);
        expect(after?.title).toBe(task.title);
        expect(after?.tenantId).toBe(w.a.id);
      },
    );
  });

  describe('POST /tasks', () => {
    it('writes no row for a customerId from another tenant', async () => {
      const admin = await w.as(w.a.admin);
      const title = `cross-customer-${Date.now()}`;
      await admin.post('/api/tasks').send({ title, customerId: w.b.customer.id });
      expect(await w.prisma.task.count({ where: { title } })).toBe(0);
    });

    it('writes no row for an assigneeId from another tenant', async () => {
      const admin = await w.as(w.a.admin);
      const title = `cross-assignee-${Date.now()}`;
      await admin
        .post('/api/tasks')
        .send({ title, customerId: w.a.customer.id, assigneeId: w.b.alice.id });
      expect(await w.prisma.task.count({ where: { title } })).toBe(0);
    });

    it.each(['tenantId', 'createdById', 'role'])('rejects %s in the body', async (field) => {
      const admin = await w.as(w.a.admin);
      const title = `mass-assign-${field}-${Date.now()}`;
      await admin
        .post('/api/tasks')
        .send({ title, customerId: w.a.customer.id, [field]: w.b.id })
        .expect(400);
      expect(await w.prisma.task.count({ where: { title } })).toBe(0);
    });

    it('stores the caller tenant on a valid create', async () => {
      const admin = await w.as(w.a.admin);
      const res = await admin
        .post('/api/tasks')
        .send({ title: 'valid', customerId: w.a.customer.id, assigneeId: w.a.bob.id })
        .expect(201);
      expect(res.body.tenantId).toBe(w.a.id);
    });
  });
});
