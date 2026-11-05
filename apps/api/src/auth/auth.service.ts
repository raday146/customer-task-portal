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

// Valid bcrypt hash of a random string; never matches a real password.
const DUMMY_HASH = bcrypt.hashSync(randomUUID(), 10);

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: string;
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
    const payload: JwtPayload = { sub: user.id, tenantId: user.tenantId, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);
    this.logger.log(`User ${user.id} signed in (tenant ${user.tenantId})`);

    return {
      accessToken,
      user: this.toProfile(user),
    };
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
