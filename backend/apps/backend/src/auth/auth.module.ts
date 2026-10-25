import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AdmUser } from '@app/common/entities/adm-user.entity';
import { ProviderUser } from '@app/common/entities/provider-user.entity';
import { CustUser } from '@app/common/entities/cust-user.entity';
import { MechanicProfile } from '@app/common/entities/mechanic-profile.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { WsJwtGuard } from './guards/ws-jwt.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdmUser,
      ProviderUser,
      CustUser,
      MechanicProfile,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret && config.get('NODE_ENV') === 'production') {
          throw new Error('JWT_SECRET is required in production');
        }
        return {
          secret: secret || 'super-secret-key-change-in-prod',
          // Apps keep users signed in until they tap Sign out; a month avoids
          // surprise sign-outs for people who open the app occasionally.
          signOptions: { expiresIn: '30d' as const },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, WsJwtGuard],
  exports: [JwtModule, JwtAuthGuard, WsJwtGuard],
})
export class AuthModule {}
