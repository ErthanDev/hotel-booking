import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IUser } from 'src/modules/users/user.interface';
import { AppException } from 'src/common/exception/app.exception';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService
  ) {
    const secret = configService.get<string>('JWT_ACCESS_TOKEN_SECRET');
    if (!secret) {
      throw new AppException({
        message: 'JWT secret is not defined',
        errorCode: 'JWT_SECRET_NOT_DEFINED',
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: IUser) {
    const { _id, firstName, lastName, email, role } = payload;
    return {
      _id,
      firstName,
      lastName,
      email,
      role
    };
  }
}
