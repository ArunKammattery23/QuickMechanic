import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
