import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LocationModule } from './location/location.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ServicesModule } from './services/services.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { SupportModule } from './support/support.module';
import { DatabaseModule } from '@app/common/database/database.module';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { HttpThrottlerGuard } from './auth/guards/http-throttler.guard';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
    }),
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        config: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
        }
      })
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 120,
    }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    LocationModule,
    DispatchModule,
    NotificationsModule,
    ServicesModule,
    VehiclesModule,
    SupportModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: HttpThrottlerGuard,
    },
  ],
})
export class AppModule {}
