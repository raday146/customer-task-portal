import { TestWorld } from './helpers';

describe('S3 task permissions (e2e)', () => {
  let w: TestWorld;

  beforeAll(async () => {
    w = await TestWorld.create();
  });
  afterAll(() => w.close());

  describe('plain user', () => {
    it("403s editing a task assigned to someone else and doesn't change it", async () => {
      const task = await w.makeTask(w.a, { assigneeId: w.a.bob.id, title: 'bobs' });
      const alice = await w.as(w.a.alice);
      await alice.patch(`/api/tasks/${task.id}`).send({ title: 'alice-edit' }).expect(403);
      expect((await w.getTask(task.id))?.title).toBe('bobs');
    });

    it('403s completing an unassigned task', async () => {
      const task = await w.makeTask(w.a);
      const alice = await w.as(w.a.alice);
      await alice.patch(`/api/tasks/${task.id}`).send({ status: 'DONE' }).expect(403);
      expect((await w.getTask(task.id))?.status).toBe('OPEN');
    });

    it('lets a user edit and complete their own task', async () => {
      const task = await w.makeTask(w.a, { assigneeId: w.a.alice.id });
      const alice = await w.as(w.a.alice);
      await alice.patch(`/api/tasks/${task.id}`).send({ title: 'mine-edited' }).expect(200);
      const res = await alice.patch(`/api/tasks/${task.id}`).send({ status: 'DONE' }).expect(200);
      expect(res.body.status).toBe('DONE');
    });

    it('accepts the unchanged assigneeId sent back on their own task', async () => {
      const task = await w.makeTask(w.a, { assigneeId: w.a.alice.id });
      const alice = await w.as(w.a.alice);
      await alice
        .patch(`/api/tasks/${task.id}`)
        .send({ assigneeId: w.a.alice.id, status: 'IN_PROGRESS' })
        .expect(200);
    });

    it('403s reassigning their own task to someone else (or unassigning it)', async () => {
      const task = await w.makeTask(w.a, { assigneeId: w.a.alice.id });
      const alice = await w.as(w.a.alice);
      await alice.patch(`/api/tasks/${task.id}`).send({ assigneeId: w.a.bob.id }).expect(403);
      await alice.patch(`/api/tasks/${task.id}`).send({ assigneeId: null }).expect(403);
      expect((await w.getTask(task.id))?.assigneeId).toBe(w.a.alice.id);
    });

    it('403s DELETE, even on their own task', async () => {
      const task = await w.makeTask(w.a, { assigneeId: w.a.alice.id });
      const alice = await w.as(w.a.alice);
      await alice.delete(`/api/tasks/${task.id}`).expect(403);
      expect(await w.getTask(task.id)).not.toBeNull();
    });

    it("404s (not 403) on another tenant's task: tenant lookup comes first", async () => {
      const task = await w.makeTask(w.b, { assigneeId: w.b.alice.id });
      const alice = await w.as(w.a.alice);
      await alice.patch(`/api/tasks/${task.id}`).send({ title: 'x' }).expect(404);
    });
  });

  describe('admin', () => {
    it('can edit, assign, reassign and delete any task in the company', async () => {
      const task = await w.makeTask(w.a, { assigneeId: w.a.bob.id });
      const admin = await w.as(w.a.admin);
      await admin.patch(`/api/tasks/${task.id}`).send({ title: 'admin-edit' }).expect(200);
      const res = await admin
        .patch(`/api/tasks/${task.id}`)
        .send({ assigneeId: w.a.alice.id })
        .expect(200);
      expect(res.body.assigneeId).toBe(w.a.alice.id);
      await admin.delete(`/api/tasks/${task.id}`).expect(204);
      expect(await w.getTask(task.id)).toBeNull();
    });
  });
});
