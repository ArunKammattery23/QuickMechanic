import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceType } from '@app/common/entities/service-type.entity';

@Injectable()
export class ServicesService implements OnModuleInit {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    @InjectRepository(ServiceType)
    private serviceTypeRepository: Repository<ServiceType>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultServices();
  }

  async seedDefaultServices() {
    const defaultServices = [
      { name: 'Flat Tire', description: 'Patch or replace flat tires.' },
      { name: 'Battery Jump Start', description: 'Jump start a dead battery.' },
      { name: 'Fuel Delivery', description: 'Delivery of emergency fuel.' },
      { name: 'Towing', description: 'Tow vehicle to nearest safe location or garage.' },
      { name: 'Lockout / Key Retrieval', description: 'Unlock car doors.' },
      { name: 'General Engine Diagnostics', description: 'Check engine light diagnostics.' },
      { name: 'Unknown Trouble', description: 'General inspection for unidentified issues.' },
    ];

    for (const service of defaultServices) {
      const existing = await this.serviceTypeRepository.findOne({ where: { name: service.name } });
      if (!existing) {
        const newService = this.serviceTypeRepository.create(service);
        await this.serviceTypeRepository.save(newService);
        this.logger.log(`Seeded default service: ${service.name}`);
      }
    }
  }

  async getAllServices() {
    return this.serviceTypeRepository.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }
}
