import { Controller, Post, Patch, Get, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/customer')
  async registerCustomer(@Body() body: any) {
    const result = await this.authService.registerCustomer(body);
    return { message: 'Customer registered successfully', data: result };
  }

  @Post('register/mechanic')
  async registerMechanic(@Body() body: any) {
    const result = await this.authService.registerMechanic(body);
    return { message: 'Mechanic registered successfully (KYC Pending)', data: result };
  }

  @Post('login')
  async login(@Body() body: any) {
    const result = await this.authService.login(body);
    return { accessToken: result.accessToken, role: result.role };
  }

  @Post('admin-login')
  async adminLogin(@Body() body: any) {
    return this.authService.adminLogin(body);
  }

  @Post('google')
  @HttpCode(200)
  google(@Body() body: unknown) {
    return this.authService.googleAuthentication(body);
  }

  @Get('admin/me')
  @UseGuards(JwtAuthGuard)
  adminMe(@Req() req: any) { return this.authService.adminMe(req.user); }

  @Patch('admin/me')
  @UseGuards(JwtAuthGuard)
  updateAdminMe(@Req() req: any, @Body() body: any) { return this.authService.updateAdminMe(req.user, body); }

  @Patch('admin/me/password')
  @UseGuards(JwtAuthGuard)
  changeAdminPassword(@Req() req: any, @Body() body: any) { return this.authService.changeAdminPassword(req.user, body); }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body);
  }
}
