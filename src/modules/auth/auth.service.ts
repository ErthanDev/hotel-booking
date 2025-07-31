import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../users/schema/user.schema';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppException } from 'src/common/exception/app.exception';
import { IUser } from '../users/user.interface';
import { Response } from 'express';
@Injectable()
export class AuthService {

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService
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
    return user.save();
  }

  async handleLogin(user: IUser, response: Response) {
    const payload = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME'),
    });
    response.cookie('access_token', accessToken, { httpOnly: true });
    return {
      access_token: accessToken,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      address: user.address,
    };

  }

  async getMyProfile(payload: IUser) {

    return payload;
  }

}
