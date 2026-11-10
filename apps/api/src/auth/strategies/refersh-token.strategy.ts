import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import {  RefreshPayload } from '../auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.refreshToken || null; 
        },
      ]),
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  async validate(payload: RefreshPayload) {
    const userId = payload.sub;
    const tokenVersionFromToken = payload.var;

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }
    
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.var.toNumber() !==  tokenVersionFromToken) {
      throw new UnauthorizedException('Refresh token is invalid or has been revoked');
    }

    return user;  
}
}