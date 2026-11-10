import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from '../auth.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.refreshToken || null; 
        },
      ]),
      secretOrKey: process.env.JWT_REFRESH_SECRET!,
    });
  }

  async validate(payload: JwtPayload) {
    const userId = payload.sub;
    const tokenVersionFromToken = payload.var;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.var.toNumber() !==  tokenVersionFromToken) {
      throw new UnauthorizedException('Refresh token is invalid or has been revoked');
    }

    return user;  
}
}