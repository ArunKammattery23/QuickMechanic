import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LocationModule } from './location/location.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DatabaseModule } from '@common/database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    LocationModule,
    DispatchModule,
    NotificationsModule,
  ],
})
export class AppModule {}
