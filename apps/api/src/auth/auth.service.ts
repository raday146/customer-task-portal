import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { Prisma } from '@prisma/client';

// Valid bcrypt hash of a random string; never matches a real password.
const DUMMY_HASH = bcrypt.hashSync(randomUUID(), 10);

export type UserWithTenant = Prisma.UserGetPayload<{
  include: { tenant: true };
}>;
export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: string;
  var: number;
}
export interface RefreshPayload {
  sub: string;
  var: number;
  type: 'refresh';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Failed-login limiter state, keyed by `${ip}|${lowercased email}`.
   * ponytail: in-memory and per-process, so it only works for a single instance; with several
   * instances a shared store such as Redis is needed. Behind a proxy/load balancer the app must
   * enable `trust proxy` for `req.ip` to be the real client IP rather than the proxy's.
   */
  private readonly failures = new Map<string, { count: number; windowStart: number }>();

  private async issueTokens(payload: JwtPayload) {
    const refreshPayload: RefreshPayload = {...payload, type: 'refresh'};

   const [accessToken, refreshToken] = await Promise.all([
    this.jwt.signAsync(payload, { 
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m'
      }),
      this.jwt.signAsync(refreshPayload, { 
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d'
      }),
    ]);
    return { accessToken, refreshToken };
  }
  async login(dto: LoginDto, ip: string) {
    const email = dto.email.toLowerCase();
    const key = `${ip}|${email}`;
    this.assertNotLimited(key);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    // Always run a compare (against a dummy hash for unknown emails) so response time doesn't reveal which emails exist.
    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      this.recordFailure(key);
      this.logger.warn(`Login failed for ${dto.email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

  this.failures.delete(key);
  
  const jwtPayload = { 
    sub: user.id, 
    tenantId: user.tenantId, 
    role: user.role, 
    var: user.var.toNumber() 
  };

  const { accessToken, refreshToken } = await this.issueTokens(jwtPayload);

  this.logger.log(`User ${user.id} signed in (tenant ${user.tenantId})`);
    return {
      accessToken,
      refreshToken,
      user: this.toProfile(user),
    };
  }
async refreshTokens(user: UserWithTenant) {
    const jwtPayload: JwtPayload = { 
      sub: user.id, 
      tenantId: user.tenantId, 
      role: user.role, 
      var: user.var.toNumber() 
    };

    const tokens = await this.issueTokens(jwtPayload);
    
    return { 
      ...tokens, 
      user: this.toProfile(user) 
    };
  }

 // auth.service.ts
  async logout(userId: string) {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          var: { increment: 1 },
        },
      });
      this.logger.log(`User ${userId} logged out (tokens revoked)`);
    } catch (error) {
      this.logger.warn(`Logout failed silently: User ${userId} not found in DB`);
    }

    return { success: true };
  }
  /** Returns the live entry for `key`, pruning it (and any other expired entry) first. */
  private liveEntry(key: string): { count: number; windowStart: number } | undefined {
    const windowMs = Number(this.config.get('LOGIN_WINDOW_MS', 15 * 60 * 1000));
    const now = Date.now();
    for (const [k, e] of this.failures) {
      if (now - e.windowStart >= windowMs) this.failures.delete(k);
    }
    return this.failures.get(key);
  }

  private assertNotLimited(key: string): void {
    const max = Number(this.config.get('LOGIN_MAX_ATTEMPTS', 5));
    if ((this.liveEntry(key)?.count ?? 0) >= max) {
      throw new HttpException('Too many failed login attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private recordFailure(key: string): void {
    const entry = this.liveEntry(key);
    if (entry) entry.count += 1;
    else this.failures.set(key, { count: 1, windowStart: Date.now() });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.toProfile(user);
  }

  private toProfile(user: {
    id: string;
    name: string;
    email: string;
    role: string;
    tenantId: string;
    tenant: { id: string; name: string };
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant: { id: user.tenant.id, name: user.tenant.name },
    };
  }
}
