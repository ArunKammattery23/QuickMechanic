import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SupportService, supportAnswer } from './support.service';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}
  @Post('bot') bot(@Body('question') question: unknown) { return supportAnswer(question); }
  @Post('tickets') create(@Req() req: any, @Body() body: any) { return this.support.create(req.user, body); }
  @Get('tickets') mine(@Req() req: any) { return this.support.listMine(req.user); }
  @Get('admin/tickets') admin(@Req() req: any, @Query('status') status?: string) { return this.support.listAdmin(req.user, status); }
  @Get('tickets/:id') detail(@Req() req: any, @Param('id') id: string) { return this.support.detail(req.user, id); }
  @Post('tickets/:id/messages') reply(@Req() req: any, @Param('id') id: string, @Body('message') message: unknown) { return this.support.reply(req.user, id, message); }
  @Patch('admin/tickets/:id/status') status(@Req() req: any, @Param('id') id: string, @Body('status') status: unknown) { return this.support.updateStatus(req.user, id, status); }
}
