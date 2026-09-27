import { ExecutionContext, Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  @Inject(JwtService) private readonly jwt: JwtService;

  protected async getTracker(req: Record<string, any>): Promise<string> {
    try {
      const token = req.headers?.authorization?.replace(/^Bearer /, '');
      const user = await this.jwt.verifyAsync(token);
      if (user.sub) return 'user:' + user.sub;
    } catch { /* Anonymous requests retain IP-based limits. */ }
    return req.ip;
  }
  canActivate(context: ExecutionContext): Promise<boolean> {
    // Socket handlers use WsJwtGuard; the HTTP throttler requires an Express request.
    return context.getType() === 'http'
      ? super.canActivate(context)
      : Promise.resolve(true);
  }
}
