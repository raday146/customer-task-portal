import { TestWorld } from './helpers';

describe('POST /tasks business-rule failures (e2e)', () => {
  let w: TestWorld;

  beforeAll(async () => {
    w = await TestWorld.create();
  });
  afterAll(() => w.close());

  const errorShape = {
    statusCode: 400,
    error: expect.any(String),
    message: expect.any(String),
    path: '/api/tasks',
    timestamp: expect.any(String),
  };
  const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

  it('returns 400 for a customerId from another tenant', async () => {
    const admin = await w.as(w.a.admin);
    const res = await admin.post('/api/tasks').send({ title: 't', customerId: w.b.customer.id });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorShape);
  });

  it('returns 400 for an assigneeId from another tenant', async () => {
    const admin = await w.as(w.a.admin);
    const res = await admin
      .post('/api/tasks')
      .send({ title: 't', customerId: w.a.customer.id, assigneeId: w.b.alice.id });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorShape);
  });

  it('returns 400 for a past due date', async () => {
    const admin = await w.as(w.a.admin);
    const res = await admin
      .post('/api/tasks')
      .send({ title: 't', customerId: w.a.customer.id, dueDate: daysFromNow(-3) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(errorShape);
    expect(res.body.message).toBe('Due date cannot be in the past');
  });

  it('still returns 201 with the created task for a valid create', async () => {
    const admin = await w.as(w.a.admin);
    const res = await admin
      .post('/api/tasks')
      .send({ title: 'ok', customerId: w.a.customer.id, dueDate: daysFromNow(3) });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'ok', customerId: w.a.customer.id, tenantId: w.a.id });
  });
});
