import { TestWorld } from './helpers';

const DAY = 86400000;
const at = (days: number) => new Date(Date.now() + days * DAY);

interface Upcoming {
  id: string;
  title: string;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
  customer: { id: string; name: string };
}

describe('GET /dashboard characterization (e2e)', () => {
  let w: TestWorld;

  beforeAll(async () => {
    w = await TestWorld.create();
  });
  afterAll(() => w.close());

  it('returns exact counts, top customers (ties, limit) and upcoming order for tenant A', async () => {
    const { a } = w;
    // [name, status, tasks: [status, dueInDays | null]]
    type T = ['OPEN' | 'IN_PROGRESS' | 'DONE', number | null];
    const spec: Array<[string, 'ACTIVE' | 'INACTIVE', T[]]> = [
      // 3 open, 1 overdue, 1 done
      [
        'C-Alpha',
        'ACTIVE',
        [
          ['OPEN', -3],
          ['IN_PROGRESS', 1],
          ['OPEN', null],
          ['DONE', 2],
        ],
      ],
      // 3 open, 2 overdue -> outranks Alpha on the overdue tie-break
      [
        'C-Bravo',
        'ACTIVE',
        [
          ['OPEN', -2],
          ['OPEN', -1],
          ['IN_PROGRESS', 3],
        ],
      ],
      // Charlie/Delta/Echo: 2 open, 0 overdue -> tied, name order decides
      [
        'C-Charlie',
        'ACTIVE',
        [
          ['OPEN', 4],
          ['OPEN', null],
        ],
      ],
      [
        'C-Delta',
        'ACTIVE',
        [
          ['OPEN', 5],
          ['IN_PROGRESS', 6],
        ],
      ],
      [
        'C-Echo',
        'ACTIVE',
        [
          ['OPEN', 7],
          ['OPEN', null],
        ],
      ],
      // below the top-5 cut
      ['C-Foxtrot', 'ACTIVE', [['OPEN', 8]]],
      ['C-Golf', 'ACTIVE', [['IN_PROGRESS', null]]],
      // inactive, only completed work (past due but DONE is never overdue)
      ['C-Hotel', 'INACTIVE', [['DONE', -10]]],
    ];
    const titles = new Map<string, string>();
    for (const [name, status, tasks] of spec) {
      const c = await w.makeCustomer(a, `${name}-${a.id.slice(0, 8)}`, status);
      let i = 0;
      for (const [ts, due] of tasks) {
        const title = `${name}#${i++}`;
        titles.set(title, c.id);
        await w.makeTask(a, {
          customerId: c.id,
          status: ts,
          title,
          dueDate: due === null ? null : at(due),
          assigneeId: title === 'C-Alpha#0' ? a.alice.id : null,
        });
      }
    }

    const res = await (await w.as(a.admin)).get('/api/dashboard').expect(200);
    const body = res.body;

    // 2 base customers + 8 above; 1 inactive
    expect(body.customers).toBe(10);
    expect(body.activeCustomers).toBe(9);
    expect(body.openTasks).toBe(14);
    expect(body.completedTasks).toBe(2);
    expect(body.overdueTasks).toBe(3);

    expect(
      body.topCustomers.map((c: { name: string }) => c.name.split('-').slice(0, 2).join('-')),
    ).toEqual(['C-Bravo', 'C-Alpha', 'C-Charlie', 'C-Delta', 'C-Echo']);
    expect(body.topCustomers.map((c: { openTasks: number }) => c.openTasks)).toEqual([
      3, 3, 2, 2, 2,
    ]);
    expect(body.topCustomers.map((c: { overdueTasks: number }) => c.overdueTasks)).toEqual([
      2, 1, 0, 0, 0,
    ]);
    expect(Object.keys(body.topCustomers[0]).sort()).toEqual([
      'id',
      'name',
      'openTasks',
      'overdueTasks',
    ]);

    // 10 open tasks have due dates; earliest 8, ascending. Nulls would sort last.
    const up: Upcoming[] = body.upcomingTasks;
    expect(up.map((t) => t.title)).toEqual([
      'C-Alpha#0', // -3
      'C-Bravo#0', // -2
      'C-Bravo#1', // -1
      'C-Alpha#1', // +1
      'C-Bravo#2', // +3
      'C-Charlie#0', // +4
      'C-Delta#0', // +5
      'C-Delta#1', // +6
    ]);
    expect(up[0].assignee).toEqual({ id: a.alice.id, name: 'alice' });
    expect(up[1].assignee).toBeNull();
    expect(up[0].customer.id).toBe(titles.get('C-Alpha#0'));
    expect(Object.keys(up[0]).sort()).toEqual([
      'assignee',
      'assigneeId',
      'createdAt',
      'customer',
      'customerId',
      'description',
      'dueDate',
      'id',
      'status',
      'tenantId',
      'title',
      'updatedAt',
    ]);
  });

  it('puts tasks without a due date last in upcoming for tenant B', async () => {
    const { b } = w;
    const nullDue = await w.makeTask(b, { title: 'no-date' });
    const late = await w.makeTask(b, { title: 'late', dueDate: at(9) });
    const soon = await w.makeTask(b, { title: 'soon', dueDate: at(2) });
    await w.makeTask(b, { title: 'finished', status: 'DONE', dueDate: at(1) });

    const res = await (await w.as(b.admin)).get('/api/dashboard').expect(200);
    expect(res.body.upcomingTasks.map((t: { id: string }) => t.id)).toEqual([
      soon.id,
      late.id,
      nullDue.id,
    ]);
    expect(res.body).toMatchObject({
      customers: 2,
      activeCustomers: 2,
      openTasks: 3,
      completedTasks: 1,
      overdueTasks: 0,
    });
    expect(res.body.topCustomers).toEqual([
      { id: b.customer.id, name: b.customer.name, openTasks: 3, overdueTasks: 0 },
    ]);
  });
});
