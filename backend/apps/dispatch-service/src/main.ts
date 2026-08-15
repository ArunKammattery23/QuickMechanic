import { NestFactory } from '@nestjs/core';
import { DispatchServiceModule } from './dispatch-service.module';

async function bootstrap() {
  const app = await NestFactory.create(DispatchServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
