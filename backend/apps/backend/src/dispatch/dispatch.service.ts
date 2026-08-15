import { Injectable } from '@nestjs/common';

@Injectable()
export class DispatchService {
  
  // Implements the formula: Base Service Fee + (Total Distance (km) * Rate)
  calculateInvoice(baseFee: number, distanceInKm: number, ratePerKm: number, isSurge: boolean): number {
    let total = baseFee + (distanceInKm * ratePerKm);
    
    if (isSurge) {
      total = total * 1.5; // 1.5x Surge Pricing
    }
    
    return total;
  }

  async findNearestMechanics(lat: number, lng: number, radiusInKm: number = 5) {
    // TODO: Connect to TypeORM Repository for MechanicProfile
    return [
      { id: 'mech-1', distance: '1.2km', eta: '5 mins' },
      { id: 'mech-2', distance: '3.4km', eta: '12 mins' }
    ];
  }

  async createServiceRequest(customerId: string, serviceType: string, lat: number, lng: number) {
    const nearbyMechanics = await this.findNearestMechanics(lat, lng);
    
    // TODO: Save ServiceRequest to DB with status = 'REQUESTED'
    
    return {
      message: 'Breakdown request submitted',
      nearbyMechanicsFound: nearbyMechanics.length,
      jobId: 'job-uuid-here'
    };
  }
}
