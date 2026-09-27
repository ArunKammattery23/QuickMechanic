import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VehicleCategory } from '@app/common/entities/vehicle-category.entity';

@Injectable()
export class VehiclesService implements OnModuleInit {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    @InjectRepository(VehicleCategory)
    private vehicleCategoryRepository: Repository<VehicleCategory>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultVehicleCategories();
  }

  async seedDefaultVehicleCategories() {
    const defaultCategories = [
      { group: '2 Wheeler', name: 'Standard Bike / Scooter', description: 'Regular two-wheelers', isPremiumTier: false },
      { group: '2 Wheeler', name: 'Premium / Superbike', description: 'High-end motorcycles', isPremiumTier: true },
      { group: '3 Wheeler', name: 'Auto Rickshaw', description: 'Three-wheeler transport', isPremiumTier: false },
      { group: '4 Wheeler', name: 'Standard Car (Hatchback/Sedan)', description: 'Everyday cars', isPremiumTier: false },
      { group: '4 Wheeler', name: 'SUV / MUV', description: 'Large passenger vehicles', isPremiumTier: false },
      { group: '4 Wheeler', name: 'Luxury / Premium Car', description: 'High-end or imported cars requiring special care', isPremiumTier: true },
      { group: 'Commercial', name: 'Light Commercial / Pickup', description: 'Delivery vans and small trucks', isPremiumTier: false },
      { group: 'Commercial', name: 'Heavy Duty Truck / Bus', description: 'Large commercial transport', isPremiumTier: false },
    ];

    for (const category of defaultCategories) {
      const existing = await this.vehicleCategoryRepository.findOne({ 
        where: { group: category.group, name: category.name } 
      });
      if (!existing) {
        const newCategory = this.vehicleCategoryRepository.create(category);
        await this.vehicleCategoryRepository.save(newCategory);
        this.logger.log(`Seeded vehicle category: [${category.group}] ${category.name}`);
      } else if (existing.isPremiumTier !== category.isPremiumTier) {
        existing.isPremiumTier = category.isPremiumTier;
        await this.vehicleCategoryRepository.save(existing);
      }
    }
  }

  async getAllVehicleCategories() {
    return this.vehicleCategoryRepository.find({ 
      where: { isActive: true }, 
      order: { group: 'ASC', name: 'ASC' } 
    });
  }
}
