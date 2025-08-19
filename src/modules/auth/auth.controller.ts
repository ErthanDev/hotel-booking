import { Controller, Get, Post, Body, Patch, Param, Delete, Res, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { User } from 'src/decorators/user-infor.decorator';
import type { IUser } from '../users/user.interface';
import { Public } from 'src/decorators/public.decorator';
import { LocalAuthGuard } from 'src/guard/local.guard';
import type { Request, Response } from 'express';
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


  @Post('refresh-token')
  @Public()
  @ResponseMessage('Refresh token generated successfully')
  async handleRefreshToken(@Req() req: Request, @Res({ passthrough: true }) response: Response) {
    const refresh_token = req.cookies['refresh_token'];
    return this.authService.handleRefreshToken(refresh_token, response);
  }

  @Post('verify-otp')
  @Public()
  @ResponseMessage('OTP verified successfully')
  async verifyOtp(@Body('email') email: string, @Body('otp') otp: string) {
    return this.authService.verifyOtp(email, otp);
  }

  @Post('forgot-password')
  @Public()
  @ResponseMessage('OTP for forgot password sent successfully')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.sendOtpForgotPassword(email);
  }

  // @Post('reset-password')
  // @Public()
  // @ResponseMessage('Password reset successfully')
  // async resetPassword(@Body('email') email: string, @Body('otp') otp: string, @Body('newPassword') newPassword: string) {
  //   return this.authService.verifyOtpForgotPassword(email, otp, newPassword);
  // }

  @Post('verify-otp-forgot-password')
  @Public()
  @ResponseMessage('OTP verified successfully')
  async verifyOtpForgotPass(@Body('email') email: string, @Body('otp') otp: string) {
    return this.authService.verifyOtpForReset(email, otp);
  }

  @Post('reset-password')
  @Public()
  @ResponseMessage('Password reset successfully')
  async resetPassword(@Body('email') email: string, @Body('resetToken') resetToken: string, @Body('newPassword') newPassword: string) {
    return this.authService.resetPasswordWithToken(email, resetToken, newPassword);
  }
}
