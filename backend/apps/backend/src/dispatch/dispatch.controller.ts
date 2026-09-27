import {
  Controller,
  Post,
  Body,
  Req,
  UnauthorizedException,
  Param,
  UseGuards,
  ForbiddenException,
  BadRequestException,
  Get,
  Query,
  Headers,
} from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { currentPolicy, paymentMode } from './pricing';

@UseGuards(JwtAuthGuard)
@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  private identity(req: Request, role: string): string {
    const user = (req as any).user;
    if (
      user.role !== role &&
      !(role === 'MECHANIC' && user.role === 'FLEET_DRIVER')
    ) {
      throw new ForbiddenException(
        'This action is not available for your role',
      );
    }
    return user.sub;
  }

  @Post('nearby')
  async getNearbyMechanics(
    @Req() req: Request,
    @Body('serviceType') serviceType: string,
    @Body('lat') lat: number,
    @Body('lng') lng: number,
    @Body('vehicleCategoryId') vehicleCategoryId?: string,
  ) {
    this.identity(req, 'CUSTOMER');

    const mechanics = await this.dispatchService.findMechanicsWithDistance(
      lat,
      lng,
      20,
      serviceType,
      vehicleCategoryId,
    );
    return { success: true, data: mechanics };
  }

  @Post('request')
  async requestMechanic(
    @Req() req: Request,
    @Body('serviceType') serviceType: string,
    @Body('lat') lat: number,
    @Body('lng') lng: number,
    @Body('mechanicId') mechanicId: string,
    @Body('vehicleCategoryId') vehicleCategoryId?: string,
  ) {
    if (!mechanicId) {
      return { success: false, message: 'mechanicId is required' };
    }

    const customerId = this.identity(req, 'CUSTOMER');

    try {
      return await this.dispatchService.createServiceRequest(
        customerId,
        serviceType,
        lat,
        lng,
        mechanicId,
        vehicleCategoryId,
      );
    } catch (err: any) {
      throw err;
    }
  }

  @Post('job/:jobId/accept')
  async acceptJob(@Req() req: Request, @Param('jobId') jobId: string) {
    const mechanicId = this.identity(req, 'MECHANIC');

    try {
      return await this.dispatchService.acceptJob(jobId, mechanicId);
    } catch (err: any) {
      throw err;
    }
  }

  @Post('job/:jobId/prepare-quote')
  prepareQuote(@Req() req: Request, @Param('jobId') jobId: string) {
    return this.dispatchService.autoQuotes.prepare(jobId, this.identity(req, 'MECHANIC'));
  }

  @Post('job/:jobId/send-quote')
  sendQuote(@Req() req: Request, @Param('jobId') jobId: string) {
    return this.dispatchService.autoQuotes.send(jobId, this.identity(req, 'MECHANIC'));
  }

  @Get('pricing')
  // Current commission settings for providers.
  async pricing(@Req() req: Request) {
    this.identity(req, 'MECHANIC');
    return this.dispatchService.payments.pricing();
  }

  @Get('active-job')
  activeJob(@Req() req: Request) {
    return this.dispatchService.activeJob(this.identity(req, 'MECHANIC'));
  }

  @Get('customer-active-job')
  customerActiveJob(@Req() req: Request) {
    return this.dispatchService.customerActiveJob(this.identity(req, 'CUSTOMER'));
  }

  @Post('job/:jobId/confirm-payment')
  async payJob(@Req() req: Request, @Param('jobId') jobId: string, @Body('simulationResult') simulationResult?: string) {
    const customerId = this.identity(req, 'CUSTOMER');

    return await this.dispatchService.payments.pay(jobId, customerId, false, simulationResult);
  }

  @Post('job/:jobId/complete')
  async completeJob(
    @Req() req: Request,
    @Param('jobId') jobId: string,
    @Body('otp') otp: string,
  ) {
    const mechanicId = this.identity(req, 'MECHANIC');

    return await this.dispatchService.completeJob(jobId, mechanicId, otp);
  }

  @Post('mechanic/withdraw')
  async withdrawFunds(@Req() req: Request, @Headers('idempotency-key') requestId: string) {
    const mechanicId = this.identity(req, 'MECHANIC');

    if (!requestId) throw new ForbiddenException('Withdrawal request ID is required');
    return await this.dispatchService.withdrawFunds(mechanicId, requestId);
  }

  @Post('job/:jobId/cancel')
  async cancelJob(@Req() req: Request, @Param('jobId') jobId: string, @Body('reason') reason: string) {
    const actor = (req as any).user;
    return await this.dispatchService.cancelJob(jobId, actor.sub, actor.role, reason);
  }

  @Post('job/:jobId/confirm-completion')
  confirmCompletion(@Req() req: Request, @Param('jobId') jobId: string) {
    return this.dispatchService.payments.confirmCompletion(jobId, this.identity(req, 'CUSTOMER'));
  }

  @Post('job/:jobId/start')
  startJourney(@Req() req: Request, @Param('jobId') jobId: string) {
    return this.dispatchService.payments.startJourney(jobId, this.identity(req, 'MECHANIC'));
  }

  @Get('history')
  history(@Req() req: Request, @Query('before') before?: string) {
    return this.dispatchService.payments.history((req as any).user, before);
  }

  @Get('transactions')
  transactions(@Req() req: Request, @Query('before') before?: string) {
    return this.dispatchService.payments.transactions((req as any).user, before);
  }

  @Get('job/:jobId')
  detail(@Req() req: Request, @Param('jobId') jobId: string) {
    return this.dispatchService.payments.detail(jobId, (req as any).user);
  }

  @Post('job/:jobId/rate')
  async rateJob(
    @Req() req: Request,
    @Param('jobId') jobId: string,
    @Body('rating') rating: number,
  ) {
    const customerId = this.identity(req, 'CUSTOMER');

    return await this.dispatchService.rateJob(jobId, rating, customerId);
  }
}
