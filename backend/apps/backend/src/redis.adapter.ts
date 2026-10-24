import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private clients: {readonly isOpen: boolean; close(): Promise<void>; destroy(): void}[] = [];
  private readonly logger = new Logger(RedisIoAdapter.name);

  async connectToRedis(redisUrl: string): Promise<void> {
    // Managed providers (Layerbase, Upstash, some Aiven endpoints) route by
    // TLS SNI, so we must set `servername` explicitly for a rediss:// URL even
    // though the hostname is already present in the URL.
    const useTls = redisUrl.startsWith('rediss://');
    const hostname = (() => { try { return new URL(redisUrl).hostname; } catch { return undefined; } })();
    const socket = useTls && hostname
      ? { tls: true as const, servername: hostname, rejectUnauthorized: true }
      : undefined;
    const pubClient = createClient({ url: redisUrl, socket } as any);
    const subClient = pubClient.duplicate();
    this.clients = [pubClient, subClient];
    for (const client of [pubClient, subClient]) client.on('error', () => this.logger.error('Redis socket adapter connection error'));
    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
    } catch (error) {
      await this.dispose();
      throw error;
    }

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }

  async dispose(): Promise<void> {
    await Promise.all(this.clients.map(async client => {
      if (client.isOpen) await client.close();
    }));
    this.clients = [];
    await super.dispose();
  }
}
