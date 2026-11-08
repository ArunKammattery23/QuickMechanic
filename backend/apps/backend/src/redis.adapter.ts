import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private clients: {readonly isOpen: boolean; close(): Promise<void>; destroy(): void}[] = [];
  private readonly logger = new Logger(RedisIoAdapter.name);

  async connectToRedis(redisUrl: string, timeoutMs = 15000): Promise<void> {
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
    // Log the real cause (never the URL, which carries the password) and the
    // reconnect lifecycle, so a dropped connection can be told from a lasting one.
    for (const [name, client] of [['pub', pubClient], ['sub', subClient]] as const) {
      client.on('error', (error: Error & { code?: string }) =>
        this.logger.error(`Redis socket adapter (${name}) connection error: ${error?.code ? `${error.code} ` : ''}${error?.message ?? error}`));
      client.on('reconnecting', () => this.logger.warn(`Redis socket adapter (${name}) reconnecting`));
      client.on('ready', () => this.logger.log(`Redis socket adapter (${name}) ready`));
    }
    // A sleeping managed Redis can accept the TCP connection and then never
    // finish waking. Give up after `timeoutMs` so the API still starts.
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Redis did not connect within ${timeoutMs} ms`)), timeoutMs);
    });
    try {
      await Promise.race([Promise.all([pubClient.connect(), subClient.connect()]), timeout]);
    } catch (error) {
      // destroy() also stops the clients' background reconnect attempts.
      for (const client of this.clients) if (client.isOpen) client.destroy();
      this.clients = [];
      throw error;
    } finally {
      clearTimeout(timer);
    }

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    // Without Redis, Socket.IO keeps its default in-memory adapter, which is
    // correct for a single instance.
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
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
