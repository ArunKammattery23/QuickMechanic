import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/customer')
  async registerCustomer(@Body() body: any) {
    // TODO: Validate incoming DTO and pass to AuthService
    return { message: 'Customer registered successfully', data: body };
  }

  @Post('register/mechanic')
  async registerMechanic(@Body() body: any) {
    // TODO: Validate mechanic DTO with KYC fields
    return { message: 'Mechanic registered successfully (KYC Pending)', data: body };
  }

  @Post('login')
  async login(@Body() body: any) {
    // TODO: Verify email and password, return JWT
    return { accessToken: 'jwt-token-here' };
  }

  @Post('admin-login')
  async adminLogin(@Body() body: any) {
    // TODO: Verify Super Admin credentials only, return elevated JWT
    return { accessToken: 'super-admin-jwt-token' };
  }
}
