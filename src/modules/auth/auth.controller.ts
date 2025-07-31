import { Controller, Get, Post, Body, Patch, Param, Delete, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { User } from 'src/decorators/user-infor.decorator';
import type { IUser } from '../users/user.interface';
import { Public } from 'src/decorators/public.decorator';
import { LocalAuthGuard } from 'src/guard/local.guard';
import type { Response } from 'express';
import { ResponseMessage } from 'src/decorators/response-message.decorator';


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  @Public()
  @ResponseMessage('User registered successfully')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @Public()
  @ResponseMessage('User logged in successfully')
  @UseGuards(LocalAuthGuard)
  async login(@User() user: IUser,
    @Res({ passthrough: true }) response: Response) {

    return this.authService.handleLogin(user, response);
  }

  @Get('profile')
  @ResponseMessage('User profile retrieved successfully')
  async getMyProfile(@User() user: IUser) {
    return this.authService.getMyProfile(user);
  }
}
