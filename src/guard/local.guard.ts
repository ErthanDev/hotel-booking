
import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
    handleRequest(err, user, info, context, status) {
        const request = context.switchToHttp().getRequest();
        const { email, password } = request.body;
        if (err || !user) {
          if (!email) {
            throw new HttpException({ message: 'Email is required' },HttpStatus.BAD_REQUEST);
          } else if (!password) {
            throw new HttpException({ message: 'Password is required' },HttpStatus.BAD_REQUEST);
          } else {
            throw err || new UnauthorizedException();
          }
        }
        return user;
      }
}
