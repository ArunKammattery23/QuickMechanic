import { Controller, Get } from '@nestjs/common';
import { LocationServiceService } from './location-service.service';

@Controller()
export class LocationServiceController {
  constructor(private readonly locationServiceService: LocationServiceService) {}

  @Get()
  getHello(): string {
    return this.locationServiceService.getHello();
  }
}
