import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post, Res, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Ip() ip: string, @Res({ passthrough: true })  res: Response) {
    const result = await this.authService.login(dto, ip);
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite:'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return {
    accessToken: result.accessToken,
    user: result.user,
  };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(user.id);

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return { message: 'Logged out successfully' };
  }
}
