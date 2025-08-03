import { BadRequestException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../users/schema/user.schema';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppException } from 'src/common/exception/app.exception';
import { IUser } from '../users/user.interface';
import ms from 'ms';
import { CacheService } from '../cache/cache.service';
import { NAME_ACTION } from 'src/constants/name-action.enum';
import { NAME_QUEUE } from 'src/constants/name-queue.enum';
import { Response } from 'express';
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private timeResendEmail = 60;
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly cacheService: CacheService
  ) { }


  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userModel.findOne({ email }).lean();
    if (!user) {
      throw new AppException({
        message: 'User with this email not found',
        errorCode: 'USER_NOT_FOUND',
        statusCode: HttpStatus.NOT_FOUND,
      });
    }
    const isMatch = await bcrypt.compare(pass, user?.password);
    if (user && isMatch) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }


  async register(payload: RegisterDto) {
    const { email, password, address, confirmPassword, firstName, lastName, phoneNumber } = payload;
    const existingUser = await this.userModel.findOne({ email }).lean();
    if (existingUser) {
      throw new AppException({
        message: 'User with this email already exists',
        errorCode: 'USER_EMAIL_EXISTS',
        statusCode: HttpStatus.CONFLICT,
      });
    }
    if (password !== confirmPassword) {
      throw new AppException({
        message: 'User password mismatch',
        errorCode: 'USER_PASSWORD_MISMATCH',
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new this.userModel({
      email, password: hashedPassword, address, firstName, lastName, phoneNumber
    });
    await this.sendOtp(email);
    return user.save();
  }

  async handleLogin(user: IUser, response: Response) {
    const payload = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      phoneNumber: user.phoneNumber,
      sub: "token login",
      iss: "from server",
    };

    const refresh_token = this.generateRefreshToken(payload)
    const refreshExpiresIn: string = this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION_TIME') || '1d';
    const maxAge: number = ms(refreshExpiresIn) ?? 0;

    response.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: true,
      maxAge: maxAge,
      sameSite: 'none',
    });
    if (!user.isVerified) {
      await this.sendOtp(user.email);
      return {
        isVerified: user.isVerified,
        user: {
          email: user.email,
        }
      }
    }
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        email: user.email,
      }
    };

  }

  async getMyProfile(payload: IUser) {

    return payload;
  }

  private generateRefreshToken = (payload: any) => {
    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION_TIME')
    })
    return refresh_token
  }


  async handleRefreshToken(refreshToken: string, response: Response) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      });

      const user = await this.userModel.findById(payload._id).lean();
      if (!user) {
        throw new AppException({
          message: 'User not found',
          errorCode: 'USER_NOT_FOUND',
          statusCode: HttpStatus.NOT_FOUND,
        });
      }

      const newPayload = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        phoneNumber: user.phoneNumber,
        sub: "token refresh",
        iss: "from server",
      };

      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME'),
      });

      const newRefreshToken = this.generateRefreshToken(newPayload);

      const refreshExpiresIn: string = this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION_TIME') || '1d';
      const maxAge: number = ms(refreshExpiresIn) ?? 0;
      response.cookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: true,
        maxAge: maxAge,
        sameSite: 'none',
      });

      return {
        access_token: newAccessToken,
        user: {
          email: user.email,
        }
      };

    } catch (error) {
      response.clearCookie('refresh_token');

      throw new AppException({
        message: 'Invalid refresh token',
        errorCode: 'INVALID_REFRESH_TOKEN',
        statusCode: HttpStatus.UNAUTHORIZED,
      });
    }
  }

  private async sendOtp(email: string) {
    this.logger.debug(`Start send otp verify email:  ${email}`);
    const currentTime = Date.now();
    const cachedData = await this.cacheService.getValueOtp(
      NAME_ACTION.SEND_OTP_VERIFY_EMAIL,
      email,
    );

    if (
      cachedData.time &&
      (currentTime - Number(cachedData.time)) / 1000 < this.timeResendEmail
    ) {
      this.logger.warn(
        `send OTP Verify Email ,Email resend blocked. Time since last email: ${(currentTime - Number(cachedData.time)) / 1000}s` +
        'email' +
        email,
      );
      throw new AppException({
        message: `Email resend blocked. Time since last email: ${(currentTime - Number(cachedData.time)) / 1000}s`,
        errorCode: 'EMAIL_RESEND_BLOCKED',
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    const userUseEmail = await this.userModel.findOne({ email });
    if (userUseEmail?.isVerified) {
      this.logger.warn(
        `Send OTP Verify Email ${email}, Email already in use }`,
      );
      throw new AppException({
        message: `Email already in use`,
        errorCode: 'EMAIL_ALREADY_IN_USE',
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    await this.cacheService.generateOtp(
      NAME_ACTION.SEND_OTP_VERIFY_EMAIL,
      email,
      currentTime,
      NAME_QUEUE.SEND_OTP_VERIFY_EMAIL,
    );

    this.logger.debug(`End send otp verify email email ${email}`);

    return {
      success: true,
      message: `Email has been sent ${email}`,
    };
  }

  async verifyOtp(email: string, otp: string) {
    this.logger.debug(`Start verify otp email: ${email}`);
    const isValidEmail = await this.cacheService.validateOtp(NAME_ACTION.SEND_OTP_VERIFY_EMAIL, email, otp);
    if (!isValidEmail) {
      this.logger.warn(`Verify OTP failed for email: ${email}`);
      throw new AppException({
        message: 'Invalid or expired OTP',
        errorCode: 'INVALID_OTP',
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }
    await this.userModel.updateOne({ email }, { isVerified: true });
    this.logger.debug(`OTP verified successfully for email: ${email}`);
    await this.cacheService.deleteOtp(NAME_ACTION.SEND_OTP_VERIFY_EMAIL, email);
    this.logger.debug(`End verify otp email: ${email}`);

    return {
      success: true,
      message: 'OTP verified successfully',
    };
  }


}
