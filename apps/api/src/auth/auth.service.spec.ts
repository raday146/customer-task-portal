import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = { user: { findUnique: jest.fn() } };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };

  const user = {
    id: 'user-1',
    tenantId: 'tenant-1',
    name: 'Olivia Hart',
    email: 'admin@northstar.test',
    role: 'ADMIN',
    passwordHash: bcrypt.hashSync('DemoPass123!', 4),
    tenant: { id: 'tenant-1', name: 'Northstar Consulting' },
  };

  beforeAll(() => Logger.overrideLogger(false));

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: (_k: string, d: unknown) => d } },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('returns a token and profile for valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await service.login(
      { email: 'Admin@Northstar.test', password: 'DemoPass123!' },
      '1.1.1.1',
    );

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'admin@northstar.test' } }),
    );
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'ADMIN',
    });
    expect(result.accessToken).toBe('signed-token');
    expect(result.user).toEqual({
      id: 'user-1',
      name: 'Olivia Hart',
      email: 'admin@northstar.test',
      role: 'ADMIN',
      tenant: { id: 'tenant-1', name: 'Northstar Consulting' },
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects an incorrect password', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(
      service.login({ email: 'admin@northstar.test', password: 'wrong-password' }, '1.1.1.1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('never writes the submitted password to the logs on a failed login', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const secret = 'S3cret-attempt!';
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(
      service.login({ email: 'admin@northstar.test', password: secret }, '1.1.1.1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const logged = JSON.stringify([...warn.mock.calls, ...log.mock.calls]);
    expect(warn).toHaveBeenCalled();
    expect(logged).not.toContain(secret);
    warn.mockRestore();
    log.mockRestore();
  });

  it('rejects an unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'nobody@example.test', password: 'whatever' }, '1.1.1.1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
