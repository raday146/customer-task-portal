import { TestWorld } from './helpers';

const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

describe('PATCH /tasks/:id due date rule (e2e)', () => {
  let w: TestWorld;

  beforeAll(async () => {
    w = await TestWorld.create();
  });
  afterAll(() => w.close());

  const overdueTask = async () => {
    const task = await w.makeTask(w.a);
    const dueDate = new Date(`${day(-5)}T00:00:00.000Z`);
    await w.prisma.task.update({ where: { id: task.id }, data: { dueDate } });
    return { id: task.id, due: day(-5) };
  };

  it('allows editing the title of an overdue task that resends its unchanged dueDate', async () => {
    const { id, due } = await overdueTask();
    const admin = await w.as(w.a.admin);
    const res = await admin.patch(`/api/tasks/${id}`).send({ title: 'renamed', dueDate: due });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('renamed');
  });

  it('rejects moving the due date to a new past date', async () => {
    const { id } = await overdueTask();
    const admin = await w.as(w.a.admin);
    const res = await admin.patch(`/api/tasks/${id}`).send({ dueDate: day(-2) });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Due date cannot be in the past');
    expect((await w.getTask(id))?.dueDate?.toISOString().slice(0, 10)).toBe(day(-5));
  });

  it('allows clearing the due date', async () => {
    const { id } = await overdueTask();
    const admin = await w.as(w.a.admin);
    await admin.patch(`/api/tasks/${id}`).send({ dueDate: null }).expect(200);
    expect((await w.getTask(id))?.dueDate).toBeNull();
  });

  it('allows a future due date', async () => {
    const { id } = await overdueTask();
    const admin = await w.as(w.a.admin);
    await admin
      .patch(`/api/tasks/${id}`)
      .send({ dueDate: day(3) })
      .expect(200);
  });

  it('treats today the same as create does', async () => {
    const admin = await w.as(w.a.admin);
    const created = await admin
      .post('/api/tasks')
      .send({ title: 'today', customerId: w.a.customer.id, dueDate: day(0) });
    const { id } = await overdueTask();
    const patched = await admin.patch(`/api/tasks/${id}`).send({ dueDate: day(0) });
    expect(created.status).toBe(201);
    expect(patched.status).toBe(200);
  });
});
