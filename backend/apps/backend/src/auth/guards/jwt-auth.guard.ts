import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token');
    }
    try {
      req.user = await this.jwt.verifyAsync(header.slice(7));
      if (!req.user.sub || !req.user.role) throw new Error('Missing identity');
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
