import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { MechanicProfile } from '../entities/mechanic-profile.entity';
import { ServiceRequest } from '../entities/service-request.entity';
import { Invoice } from '../entities/invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST') || 'localhost',
        port: configService.get<number>('DB_PORT') || 5432,
        username: configService.get<string>('DB_USER') || 'postgres',
        password: configService.get<string>('DB_PASSWORD') || 'password123',
        database: configService.get<string>('DB_NAME') || 'QuickMechanic',
        entities: [User, MechanicProfile, ServiceRequest, Invoice],
        synchronize: true, // Auto-create tables in development
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
