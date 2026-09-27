import { Controller, Get } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';

@Controller('vehicle-categories')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  async getAllVehicleCategories() {
    return this.vehiclesService.getAllVehicleCategories();
  }
}
