import { randomUUID } from 'crypto';
import request from 'supertest';
import { PASSWORD, TestUser, TestWorld } from './helpers';

describe('POST /auth/login failed-attempt limiter (e2e)', () => {
  let w: TestWorld;

  beforeAll(async () => {
    w = await TestWorld.create();
  });
  afterAll(() => w.close());

  const attempt = (email: string, password: string) =>
    request(w.app.getHttpServer()).post('/api/auth/login').send({ email, password });
  const fail = (u: TestUser) => attempt(u.email, 'wrong-password');
  const failFiveTimes = async (email: string): Promise<void> => {
    for (let i = 0; i < 5; i++) await attempt(email, 'wrong-password').expect(401);
  };

  it('blocks the 6th attempt with 429 even when the password is correct', async () => {
    const user = w.a.alice;
    await failFiveTimes(user.email);
    await attempt(user.email, PASSWORD).expect(429);
  });

  it('does not affect a different email from the same IP', async () => {
    await failFiveTimes(w.a.bob.email);
    await attempt(w.b.alice.email, PASSWORD).expect(200);
  });

  it('resets the counter after a successful login', async () => {
    const user = w.b.bob;
    for (let i = 0; i < 4; i++) await fail(user).expect(401);
    await attempt(user.email, PASSWORD).expect(200);
    for (let i = 0; i < 4; i++) await fail(user).expect(401);
    await attempt(user.email, PASSWORD).expect(200);
  });

  it('treats an unknown email exactly like a known one', async () => {
    const email = `nobody-${randomUUID()}@e2e.test`;
    await failFiveTimes(email);
    await attempt(email, 'wrong-password').expect(429);
  });

  it('counts emails case-insensitively', async () => {
    const email = `Mixed-${randomUUID()}@e2e.test`;
    for (let i = 0; i < 5; i++) {
      await attempt(i % 2 ? email.toUpperCase() : email.toLowerCase(), 'wrong-password').expect(
        401,
      );
    }
    await attempt(email, 'wrong-password').expect(429);
  });

  it('allows login again once the window has passed', async () => {
    const user = w.b.admin;
    const previous = process.env.LOGIN_WINDOW_MS;
    process.env.LOGIN_WINDOW_MS = '300';
    try {
      await failFiveTimes(user.email);
      await attempt(user.email, PASSWORD).expect(429);
      await new Promise((r) => setTimeout(r, 400));
      await attempt(user.email, PASSWORD).expect(200);
    } finally {
      if (previous === undefined) delete process.env.LOGIN_WINDOW_MS;
      else process.env.LOGIN_WINDOW_MS = previous;
    }
  });
});
