import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { UsersServiceService } from './users-service.service';

@Controller('users')
export class UsersServiceController {
  constructor(private readonly usersService: UsersServiceService) {}

  @Get('mechanics/pending')
  async getPendingMechanics() {
    return this.usersService.getPendingKycMechanics();
  }

  @Patch('mechanics/:id/kyc')
  async updateKycStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.usersService.updateKycStatus(id, status);
  }

  @Patch('mechanics/:id/status')
  async toggleOnlineStatus(@Param('id') id: string, @Body('isOnline') isOnline: boolean) {
    return this.usersService.toggleOnlineStatus(id, isOnline);
  }
}
