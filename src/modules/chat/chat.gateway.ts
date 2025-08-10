import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { WsJwtGuard } from 'src/guard/ws-jwt.guard';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from 'src/constants/user-role';
import { AppException } from 'src/common/exception/app.exception';


@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
@UseGuards(WsJwtGuard)
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);
  constructor(private readonly chatService: ChatService, private readonly jwt: JwtService) { }

  afterInit(server: Server) {
    server.use((socket: Socket, next) => {
      try {
        const raw =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization ||
          (socket.handshake.query?.token as string | undefined);

        if (!raw) return next(new Error('Unauthorized'));
        const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;

        const payload = this.jwt.verify(token);
        (socket as any).user = { email: payload.email, role: payload.role };
        next();
      } catch {
        next(new AppException({
          message: 'Token invalid',
          errorCode: 'TOKEN_INVALID',
          statusCode: HttpStatus.UNAUTHORIZED,
        }));
      }
    });
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    const user = (client as any).user;
    if (!user) {
      client.disconnect(true);
      return;
    }
    const { email, role } = user;
    if (role === UserRole.ADMIN) {
      this.logger.log(`Admin connected: ${email}`);
      client.join(`admin:${email}`);
    } else {
      this.logger.log(`User connected: ${email}`);
      const conv = await this.chatService.getOrCreateConversation(email);
      this.logger.log(`User ${email} joined conversation: ${conv._id}`);
      this.joinConversation(client, conv._id.toString(), role);
    }
  }

  handleDisconnect(client: Socket) {
    // noop, bạn có thể phát 'presence' ở đây
  }

  // Client gửi tin nhắn
  @SubscribeMessage('chat:send')
  async onSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() bodyText: { text?: string; toUserEmail?: string; conversationId?: string }
  ) {
    const { email, role } = (client as any).user;
    const body = JSON.parse(bodyText as string);
    console.log(`Received message from ${email}:`, body.text);
    // Admin gửi thì cần biết user đích; User gửi thì tự map conv
    const message = await this.chatService.sendMessage({
      senderEmail: email,
      text: body.text ?? '',
      toUserEmail: role === UserRole.ADMIN ? body.toUserEmail : undefined,
      conversationId: body.conversationId,
      isAdminSender: role === UserRole.ADMIN,
    });


    this.logger.log(`Message sent by ${email}: ${message.text} to conversation ${message.conversationId}`);
    this.server.to(`conv:${message.conversationId}`).emit('chat:newMessage', message);
    this.server.to(`admin:${await this.chatService.getAdminEmail()}`).emit('chat:inboxUpdated');

    return { ok: true, messageId: message._id };
  }

  @SubscribeMessage('chat:joinRoom')
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() bodyText: { conversationId?: string; toUserEmail?: string }
  ) {
    this.logger.log(`Client ${client.id} joining room with body: ${JSON.stringify(bodyText)}`);
    const { email, role } = (client as any).user;
    const body = JSON.parse(bodyText as string);
    this.joinConversation(client, body.conversationId!, role);
    return { ok: true, conversationId: body.conversationId };
  }

  @SubscribeMessage('chat:leaveRoom')
  async onLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() bodyText: { conversationId?: string; toUserEmail?: string }
  ) {
    this.logger.log(`Client ${client.id} leaving room with body: ${JSON.stringify(bodyText)}`);
    const { email, role } = (client as any).user;
    const body = JSON.parse(bodyText as string);
    client.leave(`conv:${body.conversationId}`);
    return { ok: true, conversationId: body.conversationId };
  }

  @SubscribeMessage('chat:typing')
  async onTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string; toUserEmail?: string; isTyping: boolean }
  ) {
    const { email, role } = (client as any).user;
    const convId = await this.chatService.resolveConversationId({
      requesterEmail: email,
      isAdmin: role === 'ADMIN',
      toUserEmail: body.toUserEmail,
      conversationId: body.conversationId,
    });
    this.server.to(`conv:${convId}`).emit('chat:typing', { from: email, isTyping: body.isTyping });
  }

  @SubscribeMessage('chat:read')
  async onRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string; toUserEmail?: string }
  ) {
    const { email, role } = (client as any).user;
    const conv = await this.chatService.markRead({
      readerEmail: email,
      isAdminReader: role === 'ADMIN',
      conversationId: body.conversationId,
      toUserEmail: body.toUserEmail,
    });
    this.server.to(`conv:${conv._id}`).emit('chat:read', { by: email, at: new Date().toISOString() });
    this.server.to(`admin:${await this.chatService.getAdminEmail()}`).emit('chat:inboxUpdated');
    return { ok: true };
  }

  private async joinConversation(client: Socket, conversationId: string, role: UserRole) {
    this.logger.debug(`Client ${client.id} joining conversation ${conversationId} with role ${role}`);
    client.join(`conv:${conversationId}`);
  }

}
