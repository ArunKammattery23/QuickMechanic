import { Logger, OnModuleDestroy, UseGuards } from '@nestjs/common';
import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer } from '@nestjs/websockets';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { JobAccessService } from '../location/job-access.service';
import { CallSession, CallSessionStore } from './call-session.store';

@UseGuards(WsJwtGuard)
@WebSocketGateway({ cors: { origin: '*' } })
export class CallGateway implements OnModuleDestroy {
  @WebSocketServer() server: Server;
  private readonly sessions: CallSessionStore;
  private readonly owned = new Map<string, CallSession>();
  private timer?: NodeJS.Timeout;
  private maintaining = false;
  private readonly logger = new Logger(CallGateway.name);
  constructor(private readonly access: JobAccessService, redis: RedisService) {
    this.sessions = new CallSessionStore(redis.getOrThrow());
  }
  afterInit() {
    this.timer = setInterval(() => {
      void this.maintainCalls().catch(() => this.logger.warn('Call lease maintenance unavailable'));
    }, 15000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  private failure(code: string, message = 'This call has ended. Please try again.') {
    return { success: false, code, message };
  }
  private valid(data: any) {
    return typeof data?.callId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(data.callId)
      && typeof data.targetId === 'string' && data.targetId.length > 0 && data.targetId.length <= 128;
  }
  private emit(s: CallSession, fromCaller: boolean, event: string, payload: any) {
    this.server.to(fromCaller ? s.targetSocket : s.callerSocket).emit(event, {
      ...payload, callId: s.id, callerId: fromCaller ? s.caller : s.target,
    });
  }
  private ended(s: CallSession, reason: string) {
    this.emit(s, true, 'call_ended', { reason });
    this.emit(s, false, 'call_ended', { reason });
    this.owned.delete(s.id);
  }
  @SubscribeMessage('call_offer')
  async offer(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const user = (client as any).user;
    try {
      if (!this.valid(data) || !user || !(await this.access.canContact(user, data.targetId)))
        return this.failure('FORBIDDEN', 'No active job with this person');
      if (!data.offer || typeof data.offer.sdp !== 'string' || data.offer.sdp.length > 65536)
        return this.failure('INVALID_CALL', 'Invalid call offer');
      const targets = await this.server.in('user_' + data.targetId).fetchSockets();
      if (!targets.length) return this.failure('OFFLINE', 'The other person is offline');
      if (!client.connected) return this.failure('OFFLINE', 'You are offline. Reconnect and try again.');
      // Ring one device; another device on the account cannot hijack this call.
      const targetSocket = targets.map(s => s.id).sort()[0];
      const session: CallSession = { id: data.callId, caller: user.sub, target: data.targetId,
        callerSocket: client.id, targetSocket, state: 'ringing' };
      const result = await this.sessions.reserve(session);
      if (result === 'TARGET_BUSY') return this.failure(result,
        user.role === 'CUSTOMER' ? 'Provider is busy—try again' : 'Customer is busy—try again');
      if (result === 'CALLER_BUSY') return this.failure(result, 'You are already on a call');
      if (result !== 'OK') return this.failure(result);
      this.owned.set(session.id, session);
      if (!client.connected) {
        await this.sessions.change(session, user.sub, client.id, 'end');
        this.owned.delete(session.id);
        return this.failure('OFFLINE', 'You are offline. Reconnect and try again.');
      }
      this.emit(session, true, 'incoming_call', { offer: data.offer,
        callerName: String(data.callerName || 'Caller').slice(0, 100) });
      return { success: true };
    } catch {
      return this.failure('UNAVAILABLE', 'Calling is temporarily unavailable. Please try again.');
    }
  }
  private async relay(client: Socket, data: any, op: 'answer' | 'ice' | 'end', event: string, payload: any) {
    const user = (client as any).user;
    try {
      if (!this.valid(data) || !user) return this.failure('INVALID_CALL');
      const session = await this.sessions.get(data.callId);
      if (!session) return this.failure('STALE_CALL');
      const fromCaller = session.caller === user.sub;
      if ((fromCaller ? session.target : session.caller) !== data.targetId)
        return this.failure('INVALID_CALL');
      if (op === 'answer' && !(await this.access.canContact(user, data.targetId)))
        return this.failure('FORBIDDEN', 'No active job with this person');
      const result = await this.sessions.change(session, user.sub, client.id, op);
      if (typeof result === 'string') return this.failure(result);
      this.emit(result, fromCaller, event, payload);
      if (op === 'end') this.owned.delete(result.id);
      return { success: true };
    } catch {
      return this.failure('UNAVAILABLE', 'Calling is temporarily unavailable. Please try again.');
    }
  }
  @SubscribeMessage('call_answer')
  answer(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    if (!data?.answer || typeof data.answer.sdp !== 'string' || data.answer.sdp.length > 65536)
      return this.failure('INVALID_CALL');
    return this.relay(client, data, 'answer', 'call_answered', { answer: data.answer });
  }
  @SubscribeMessage('ice_candidate')
  candidate(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    if (!data?.candidate || typeof data.candidate.candidate !== 'string' || data.candidate.candidate.length > 8192)
      return this.failure('INVALID_CALL');
    return this.relay(client, data, 'ice', 'new_ice_candidate', { candidate: data.candidate });
  }
  @SubscribeMessage('end_call')
  end(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    return this.relay(client, data, 'end', 'call_ended', { reason: data?.reason === 'busy' ? 'busy' : 'ended' });
  }
  async handleDisconnect(client: Socket) {
    const user = (client as any).user;
    if (!user) return;
    try {
      const session = await this.sessions.forUser(user.sub);
      if (session && typeof await this.sessions.change(session, user.sub, client.id, 'end') !== 'string')
        this.ended(session, 'disconnected');
    } catch { this.logger.warn('Call disconnect cleanup unavailable; lease will expire'); }
  }
  // Caller instance owns renewal. A crashed process cannot leave a permanent
  // busy lock. Multiple instances require shared Redis and the socket adapter.
  async maintainCalls() {
    if (this.maintaining || !this.owned.size) return;
    this.maintaining = true;
    try {
      const connected = await this.server.sockets.allSockets();
      const owned = [...this.owned.values()];
      for (let i = 0; i < owned.length; i += 100) {
        await Promise.all(owned.slice(i, i + 100).map(async previous => {
          const current = await this.sessions.get(previous.id);
          if (!current) { this.ended(previous, 'expired'); return; }
          const alive = connected.has(current.callerSocket) && connected.has(current.targetSocket);
          const result = await this.sessions.change(current, current.caller, current.callerSocket, alive ? 'refresh' : 'end');
          if (!alive || typeof result === 'string') this.ended(current, alive ? 'expired' : 'disconnected');
        }));
      }
    } finally { this.maintaining = false; }
  }
}
