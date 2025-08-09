import { Logger } from "@nestjs/common";
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from 'socket.io';
@WebSocketGateway({
    namespace: '/transactions',
    cors: { origin: '*' },
    transports: ['websocket'],
})
export class TransactionGateway implements OnGatewayConnection, OnGatewayInit {

    private logger = new Logger(TransactionGateway.name);
    @WebSocketServer()
    server: Server;

    handleConnection(@ConnectedSocket() client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);


    }


    afterInit(server: any) {
        this.logger.log('WebSocket server initialized');
    }

    @SubscribeMessage('join')
    async handleJoin(
        @ConnectedSocket() client: Socket,
        @MessageBody() bookingId: string,
    ) {
        this.logger.log(`Client ${client.id} joined room ${bookingId}`);
        client.join(bookingId);
    }

    // sendPaymentUrl(userEmail: string, data: { bookingId: string; payUrl: string }) {
    //     this.logger.log(`Sending payment URL to user: ${userEmail}`);
    //     this.server.to(`${userEmail}`).emit('paymentUrl', data);
    // }

    sendBookingUpdate(bookingId: string, data: any) {
        this.server.to(bookingId).emit('booking.updated', data);
    }
}