import { TestWorld } from './helpers';

describe('S1 tenant isolation (e2e)', () => {
  let w: TestWorld;

  beforeAll(async () => {
    w = await TestWorld.create();
  });
  afterAll(() => w.close());

  describe('customers', () => {
    it("404s on another tenant's customer (no data, no neighbours)", async () => {
      const admin = await w.as(w.a.admin);
      const res = await admin.get(`/api/customers/${w.b.customer.id}`);
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain(w.b.customer.name);
    });

    it('still returns own customer with previous/next from own tenant only', async () => {
      const admin = await w.as(w.a.admin);
      const res = await admin.get(`/api/customers/${w.a.customer.id}`).expect(200);
      expect(res.body.id).toBe(w.a.customer.id);
      expect(res.body.next?.id).toBe(w.a.otherCustomer.id);
    });

    it("404s on another tenant's customer tasks", async () => {
      const admin = await w.as(w.a.admin);
      await admin.get(`/api/customers/${w.b.customer.id}/tasks`).expect(404);
    });
  });

  describe('tasks', () => {
    it("404s PATCH on another tenant's task and leaves the row unchanged", async () => {
      const task = await w.makeTask(w.b, { title: 'original' });
      const admin = await w.as(w.a.admin);
      await admin.patch(`/api/tasks/${task.id}`).send({ title: 'hijacked' }).expect(404);
      const after = await w.getTask(task.id);
      expect(after?.title).toBe('original');
      expect(after?.updatedAt).toEqual(task.updatedAt);
    });

    it("404s DELETE on another tenant's task and keeps the row", async () => {
      const task = await w.makeTask(w.b);
      const admin = await w.as(w.a.admin);
      await admin.delete(`/api/tasks/${task.id}`).expect(404);
      expect(await w.getTask(task.id)).not.toBeNull();
    });

    it('still lets an admin PATCH and DELETE a task in their own tenant', async () => {
      const task = await w.makeTask(w.a, { title: 'mine' });
      const admin = await w.as(w.a.admin);
      const res = await admin.patch(`/api/tasks/${task.id}`).send({ title: 'renamed' }).expect(200);
      expect(res.body.title).toBe('renamed');
      await admin.delete(`/api/tasks/${task.id}`).expect(204);
      expect(await w.getTask(task.id)).toBeNull();
    });
  });
});
