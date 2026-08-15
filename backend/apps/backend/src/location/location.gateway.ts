import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class LocationGateway {
  @WebSocketServer()
  server: Server;

  private mechanicSockets = new Map<string, string>(); // mechanicId -> socketId

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('update_location')
  handleLocationUpdate(
    @MessageBody() data: { mechanicId: string; lat: number; lng: number },
    @ConnectedSocket() client: Socket,
  ) {
    this.mechanicSockets.set(data.mechanicId, client.id);
    
    // Broadcast to the specific customer tracking this mechanic
    this.server.to(`tracking_${data.mechanicId}`).emit('mechanic_moved', {
      lat: data.lat,
      lng: data.lng,
      timestamp: new Date(),
    });

    return { status: 'Location updated' };
  }

  @SubscribeMessage('subscribe_to_mechanic')
  handleCustomerSubscription(
    @MessageBody() data: { mechanicId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`tracking_${data.mechanicId}`);
    return { status: `Subscribed to mechanic ${data.mechanicId}` };
  }
}
