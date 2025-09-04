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
        this.logger.log('WsJwtGuard: Checking authentication for WebSocket connection');
        const client: Socket = context.switchToWs().getClient<Socket>();
        const token =
            client.handshake.auth?.token ||
            client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
            client.handshake.query?.token;
        this.logger.debug(`Extracted token: ${token}`);
        if (!token) {
            this.logger.error('Token not found in handshake');
            throw new AppException({
                message: 'Token not found',
                errorCode: 'TOKEN_NOT_FOUND',
                statusCode: HttpStatus.UNAUTHORIZED,
            });
        }

        try {
            this.logger.log(`Verifying token: ${token}`);
            const payload = this.jwtService.verify(token);
            this.logger.log(`Token verified successfully for user: ${payload.email}`);
            (client as any).user = payload;
            return true;
        } catch {
            this.logger.error('Token verification failed');
            throw new AppException({
                message: 'Token invalid',
                errorCode: 'TOKEN_INVALID',
                statusCode: HttpStatus.UNAUTHORIZED,
            });
        }
    }
}