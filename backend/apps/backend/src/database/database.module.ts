import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// We'll import entities from the libs/common folder since they are already there, 
// or we can move them. For simplicity, we just reference them here.
import { User } from '../../../../libs/common/src/entities/user.entity';
import { MechanicProfile } from '../../../../libs/common/src/entities/mechanic-profile.entity';
import { ServiceRequest } from '../../../../libs/common/src/entities/service-request.entity';
import { Invoice } from '../../../../libs/common/src/entities/invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password123',
      database: process.env.DB_NAME || 'QuickMechanic',
      entities: [User, MechanicProfile, ServiceRequest, Invoice],
      synchronize: true, 
      autoLoadEntities: true,
    }),
  ],
})
export class DatabaseModule {}
