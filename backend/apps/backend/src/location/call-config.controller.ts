import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallConfigController {
  constructor(private readonly config: ConfigService) {}
  @Get('ice-servers')
  iceServers(@Req() req: any) {
    const iceServers: any[] = [{ urls: 'stun:stun.l.google.com:19302' }];
    const urls = this.config
      .get<string>('TURN_URLS')
      ?.split(',')
      .map((url) => url.trim())
      .filter(Boolean);
    const secret = this.config.get<string>('TURN_SECRET');
    if (urls?.length && secret) {
      const username = `${Math.floor(Date.now() / 1000) + 3600}:${req.user.sub}`;
      iceServers.push({
        urls,
        username,
        credential: createHmac('sha1', secret)
          .update(username)
          .digest('base64'),
      });
    }
    return { iceServers, relayConfigured: iceServers.length > 1 };
  }
}
