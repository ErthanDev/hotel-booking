import { Logger } from "@nestjs/common";
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from 'socket.io';
@WebSocketGateway({
    namespace: '/transactions',
    cors: { origin: '*' },
    transports: ['websocket'],
})
export class TransactionGateway implements OnGatewayConnection {
    private logger = new Logger(TransactionGateway.name);
    @WebSocketServer()
    server: Server;

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);

        
    }

    @SubscribeMessage('join')
    handleJoin(
        @ConnectedSocket() client: Socket,
        @MessageBody() userEmail: string,
    ) {
        this.logger.log(`Client ${client.id} joined room ${userEmail}`);
        client.join(userEmail);
    }

    sendPaymentUrl(userEmail: string, data: { bookingId: string; payUrl: string }) {
        this.logger.log(`Sending payment URL to user: ${userEmail}`);
        this.server.to(`${userEmail}`).emit('paymentUrl', data);
    }
}