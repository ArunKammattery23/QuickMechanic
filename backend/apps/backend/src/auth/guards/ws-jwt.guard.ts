import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();

      // Support extracting from headers or auth object in handshake
      let token: string | undefined;
      const authHeader = client.handshake.headers.authorization;
      if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
        token = authHeader.split(' ')[1];
      } else if (client.handshake.auth && client.handshake.auth.token) {
        token = client.handshake.auth.token;
      }

      if (!token) {
        throw new UnauthorizedException('Missing token');
      }

      const payload = await this.jwtService.verifyAsync(token);
      if (!payload.sub || !payload.role) throw new Error('Missing identity');

      // Attach user payload to socket
      (client as any).user = payload;

      return true;
    } catch (err) {
      throw new WsException('Invalid or expired token');
    }
  }
}
