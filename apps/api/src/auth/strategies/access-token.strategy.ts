import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../auth.service';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), 
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }

  async validate(payload: JwtPayload) {
    return { ...payload };
  }
}