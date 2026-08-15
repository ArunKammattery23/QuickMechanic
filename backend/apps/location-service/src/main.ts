import { NestFactory } from '@nestjs/core';
import { LocationServiceModule } from './location-service.module';

async function bootstrap() {
  const app = await NestFactory.create(LocationServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
