import request from 'supertest';
import { PASSWORD, TestWorld } from './helpers';

describe('POST /auth/refresh (e2e)', () => {
  let w: TestWorld;

  beforeAll(async () => {
    w = await TestWorld.create();
  });
  afterAll(() => w.close());

  const login = () =>
    request(w.app.getHttpServer()).post('/api/auth/login').send({ email: w.a.alice.email, password: PASSWORD });

  it('issues a working access token from the refresh cookie', async () => {
    const cookie = (await login().expect(200)).headers['set-cookie'];

    const res = await request(w.app.getHttpServer()).post('/api/auth/refresh').set('Cookie', cookie).expect(201);
    expect(res.body.user.tenant.id).toBe(w.a.id);

    await request(w.app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
  });

  it('rejects a missing refresh cookie', async () => {
    await request(w.app.getHttpServer()).post('/api/auth/refresh').expect(401);
  });
});
