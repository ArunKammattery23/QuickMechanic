import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { ValidationPipe } from '@nestjs/common';
import { RedisIoAdapter } from './redis.adapter';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {rawBody: true});

  // 1. Enable CORS for frontend applications
  app.enableCors({
    origin: '*', // Allow all for local dev
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, Idempotency-Key',
  });

  // 2. HTTP Headers Security (Helmet)
  app.use(helmet({
    crossOriginResourcePolicy: false,
  }));

  // 3. Rate Limiting (Prevent Brute-Force & DDoS)
  app.use(
    '/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    }),
  );

  // 4. Global Validation Pipe (Strips malicious/unknown properties from incoming JSON)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strips fields that do not have decorators
      forbidNonWhitelisted: true, // Throws error if non-whitelisted fields are provided
    }),
  );

  const configService = app.get(ConfigService);
  const redisHost = configService.get<string>('REDIS_HOST') || 'localhost';
  const redisPort = configService.get<string>('REDIS_PORT') || '6379';
  const redisUrl = `redis://${redisHost}:${redisPort}`;

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(redisUrl);
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
