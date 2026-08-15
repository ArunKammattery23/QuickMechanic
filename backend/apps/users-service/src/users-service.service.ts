import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersServiceService {
  
  async getPendingKycMechanics() {
    // TODO: Integrate TypeORM Repository to fetch mechanics where kycStatus = 'PENDING'
    return [
      { id: 'uuid-1', name: 'John Doe', serviceTier: 'FOUR_WHEELER', kycStatus: 'PENDING' }
    ];
  }

  async updateKycStatus(mechanicId: string, status: string) {
    // TODO: Validate status (APPROVED | REJECTED) and update DB
    return { success: true, message: `Mechanic ${mechanicId} KYC updated to ${status}` };
  }

  async toggleOnlineStatus(mechanicId: string, isOnline: boolean) {
    // TODO: Update isOnline boolean in DB
    return { success: true, message: `Mechanic ${mechanicId} online status set to ${isOnline}` };
  }
}
