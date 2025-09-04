import { CanActivate, ExecutionContext, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { AppException } from 'src/common/exception/app.exception';

@Injectable()
export class WsJwtGuard implements CanActivate {
    private logger = new Logger(WsJwtGuard.name);
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    canActivate(context: ExecutionContext): boolean {
        const client: Socket = context.switchToWs().getClient<Socket>();
        const token =
            client.handshake.auth?.token ||
            client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
            client.handshake.query?.token;
        if (!token) {
            throw new AppException({
                message: 'Token not found',
                errorCode: 'TOKEN_NOT_FOUND',
                statusCode: HttpStatus.UNAUTHORIZED,
            });
        }

        try {
            const payload = this.jwtService.verify(token);
            (client as any).user = payload;
            return true;
        } catch {
            throw new AppException({
                message: 'Token invalid',
                errorCode: 'TOKEN_INVALID',
                statusCode: HttpStatus.UNAUTHORIZED,
            });
        }
    }
}