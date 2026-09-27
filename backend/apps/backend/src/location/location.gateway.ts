import { UseGuards } from '@nestjs/common';
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { JwtService } from '@nestjs/jwt';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { JobAccessService } from './job-access.service';
@UseGuards(WsJwtGuard)
@WebSocketGateway({ cors: { origin: '*' } })
export class LocationGateway {
  @WebSocketServer() server: Server;
  private readonly redis: Redis;
  constructor(
    redisService: RedisService,
    private readonly jwt: JwtService,
    private readonly access: JobAccessService,
  ) {
    this.redis = redisService.getOrThrow();
  }
  afterInit(server: Server) {
    server.use(async (client, next) => {
      try {
        const token =
          client.handshake.auth?.token ||
          client.handshake.headers.authorization?.split(' ')[1];
        const user = await this.jwt.verifyAsync(token);
        if (!user.sub || !user.role) throw new Error('Missing identity');
        (client as any).user = user;
        next();
      } catch {
        next(new Error('Invalid or expired token'));
      }
    });
  }
  handleConnection(client: Socket) {
    const user = (client as any).user;
    if (!user) {
      client.disconnect(true);
      return;
    }
    client.join('user_' + user.sub);
    if (['MECHANIC', 'FLEET_DRIVER'].includes(user.role))
      client.join('tracking_' + user.sub);
    if (user.role === 'CUSTOMER') client.join('customer_' + user.sub);
  }
  @SubscribeMessage('update_location')
  async handleLocationUpdate(
    @MessageBody()
    data: {
      mechanicId: string;
      lat: number;
      lng: number;
      bearing?: number;
      accuracy?: number;
      timestamp?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const user = (client as any).user;
    if (
      !['MECHANIC', 'FLEET_DRIVER'].includes(user.role) ||
      data.mechanicId !== user.sub
    )
      throw new WsException('Not your location');
    if (
      !Number.isFinite(data.lat) ||
      !Number.isFinite(data.lng) ||
      Math.abs(data.lat) > 90 ||
      Math.abs(data.lng) > 180
    )
      throw new WsException('Invalid coordinates');
    const observed = data.timestamp ? Date.parse(data.timestamp) : Date.now();
    if (
      !Number.isFinite(observed) ||
      observed < Date.now() - 120000 ||
      observed > Date.now() + 30000
    )
      throw new WsException('Stale location');
    const location = {
      mechanicId: user.sub,
      lat: data.lat,
      lng: data.lng,
      bearing: Number.isFinite(data.bearing) ? data.bearing : 0,
      accuracy:
        Number.isFinite(data.accuracy) && data.accuracy! >= 0
          ? data.accuracy
          : null,
      timestamp: new Date(observed).toISOString(),
    };
    await this.redis.set(
      'mechanic_loc:' + user.sub,
      JSON.stringify(location),
      'EX',
      600,
    );
    await this.access.updatePresence(user.sub, data.lat, data.lng);
    // Re-check active jobs so a former customer cannot continue tracking.
    for (const customer of await this.access.trackingCustomers(user.sub)) {
      this.server
        .to('customer_' + customer)
        .emit('mechanic_location_changed', location);
    }
    return { status: 'Location updated' };
  }
  @SubscribeMessage('subscribe_to_mechanic')
  async handleCustomerSubscription(
    @MessageBody() data: { mechanicId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = (client as any).user;
    if (
      user.role !== 'CUSTOMER' ||
      !(await this.access.canContact(user, data.mechanicId))
    )
      throw new WsException('No active job with this mechanic');
    const last = await this.redis.get('mechanic_loc:' + data.mechanicId);
    if (last) client.emit('mechanic_location_changed', JSON.parse(last));
    return { status: 'Subscribed' };
  }
}
