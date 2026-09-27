import { Controller, Get, Patch, Post, Param, Body, UseGuards, UseInterceptors, UploadedFiles, Req, Res, ForbiddenException, BadRequestException } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) { return this.usersService.me(req.user); }

  @Patch('me/mobile')
  @UseGuards(JwtAuthGuard)
  updateMyMobile(@Req() req: any, @Body('phoneNumber') phoneNumber: unknown) {
    if (!['MECHANIC', 'FLEET_DRIVER'].includes(req.user.role)) throw new ForbiddenException();
    return this.usersService.updateMyMobile(req.user.sub, phoneNumber);
  }

  @Get('me/kyc')
  @UseGuards(JwtAuthGuard)
  myKyc(@Req() req: any) {
    if (!['MECHANIC', 'FLEET_DRIVER'].includes(req.user.role)) throw new ForbiddenException();
    return this.usersService.myKyc(req.user.sub);
  }

  @Post('me/kyc')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{name: 'front', maxCount: 1}, {name: 'back', maxCount: 1}],
    {limits: {fileSize: 2 * 1024 * 1024, files: 2, fields: 3, parts: 8}}))
  submitMyKyc(@Req() req: any, @Body() body: any, @UploadedFiles() files: any) {
    if (!['MECHANIC', 'FLEET_DRIVER'].includes(req.user.role)) throw new ForbiddenException();
    return this.usersService.submitMyKyc(req.user.sub, body, files);
  }

  @Get('mechanics/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingMechanics(@Req() req: any) {
    if (!['SUPER_ADMIN', 'MANAGER'].includes(req.user.role)) throw new ForbiddenException();
    return this.usersService.getPendingKycMechanics();
  }

  @Patch('mechanics/:id/kyc')
  @UseGuards(JwtAuthGuard)
  async updateKycStatus(@Req() req: any, @Param('id') id: string, @Body('status') status: string, @Body('submittedAt') submittedAt: string) {
    if (!['SUPER_ADMIN', 'MANAGER'].includes(req.user.role)) throw new ForbiddenException();
    return this.usersService.updateKycStatus(id, status, req.user.sub, submittedAt);
  }

  @Get('mechanics/:id/kyc/document/:side')
  @UseGuards(JwtAuthGuard)
  async kycDocument(@Req() req: any, @Param('id') id: string, @Param('side') side: string, @Res() response: Response) {
    if (!['SUPER_ADMIN', 'MANAGER'].includes(req.user.role)) throw new ForbiddenException();
    const image = await this.usersService.kycImage(id, side);
    response.setHeader('Content-Type', image.mime);
    response.setHeader('Cache-Control', 'no-store, private');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(image.bytes);
  }

  @Patch('mechanics/:id/status')
  @UseGuards(JwtAuthGuard)
  async toggleOnlineStatus(
    @Req() req: any,
    @Param('id') id: string, 
    @Body() body: { isOnline: boolean; lat?: number; lng?: number }
  ) {
    if (req.user.sub !== id || !['MECHANIC', 'FLEET_DRIVER'].includes(req.user.role)) throw new ForbiddenException();
    if (typeof body.isOnline !== 'boolean' || (body.isOnline && (!Number.isFinite(body.lat) || !Number.isFinite(body.lng) || Math.abs(body.lat!) > 90 || Math.abs(body.lng!) > 180))) throw new BadRequestException('Valid online status and location required');
    return this.usersService.toggleOnlineStatus(id, body.isOnline, body.lat, body.lng);
  }

  @Patch('mechanics/:id/services')
  @UseGuards(JwtAuthGuard)
  async updateServicesProvided(@Req() req: any, @Param('id') id: string, @Body('services') services: string[]) {
    if (req.user.sub !== id || !['MECHANIC', 'FLEET_DRIVER'].includes(req.user.role)) throw new ForbiddenException();
    if (!Array.isArray(services) || !services.every(s => typeof s === 'string')) throw new BadRequestException('Service IDs are required');
    return this.usersService.updateServicesProvided(id, services);
  }

  @Patch('mechanics/:id/config')
  @UseGuards(JwtAuthGuard)
  async updateConfig(
    @Req() req: any,
    @Param('id') id: string, 
    @Body() data: { 
      services?: string[], 
      vehicles?: string[],
      pricing?: { serviceId: string, vehicleId: string, price: number }[]
    }
  ) {
    if (req.user.sub !== id || !['MECHANIC', 'FLEET_DRIVER'].includes(req.user.role)) throw new ForbiddenException();
    return this.usersService.updateConfig(id, data);
  }

  @Get('mechanics/:id/config')
  async getConfig(@Param('id') id: string) {
    return this.usersService.getConfig(id);
  }

  @Get('mechanics/:id/stats/daily')
  @UseGuards(JwtAuthGuard)
  async getDailyStats(@Param('id') id: string, @Req() req: any) {
    if (req.user.sub !== id && !['SUPER_ADMIN', 'MANAGER'].includes(req.user.role)) throw new ForbiddenException();
    return this.usersService.getDailyStats(id);
  }

  @Get('mechanics/:id/requests')
  @UseGuards(JwtAuthGuard)
  async pendingRequests(@Param('id') id: string, @Req() req: any) {
    if (req.user.sub !== id || !['MECHANIC', 'FLEET_DRIVER'].includes(req.user.role)) throw new ForbiddenException();
    return this.usersService.pendingRequests(id);
  }
}
