import { UseGuards } from '@nestjs/common';
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { JobAccessService } from '../location/job-access.service';
@UseGuards(WsJwtGuard)
@WebSocketGateway({ cors: { origin: '*' } })
export class CallGateway {
  @WebSocketServer() server: Server;
  constructor(private readonly access: JobAccessService) {}
  private async relay(client: Socket, data: any, event: string, payload: any) {
    const user = (client as any).user;
    if (
      typeof data?.callId !== 'string' ||
      !data.callId ||
      !(await this.access.canContact(user, data.targetId))
    )
      return { success: false, message: 'No active job with this person' };
    const room = 'user_' + data.targetId;
    if (!(await this.server.in(room).fetchSockets()).length)
      return { success: false, message: 'The other person is offline' };
    this.server
      .to(room)
      .emit(event, { ...payload, callId: data.callId, callerId: user.sub });
    return { success: true };
  }
  @SubscribeMessage('call_offer')
  offer(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    return this.relay(client, data, 'incoming_call', {
      offer: data.offer,
      callerName: String(data.callerName || 'Caller').slice(0, 100),
    });
  }
  @SubscribeMessage('call_answer')
  answer(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    return this.relay(client, data, 'call_answered', { answer: data.answer });
  }
  @SubscribeMessage('ice_candidate')
  candidate(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    return this.relay(client, data, 'new_ice_candidate', {
      candidate: data.candidate,
    });
  }
  @SubscribeMessage('end_call')
  end(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    return this.relay(client, data, 'call_ended', {});
  }
}
