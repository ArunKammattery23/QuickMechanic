import { Controller, Get } from '@nestjs/common';
import { DispatchServiceService } from './dispatch-service.service';

@Controller()
export class DispatchServiceController {
  constructor(private readonly dispatchServiceService: DispatchServiceService) {}

  @Get()
  getHello(): string {
    return this.dispatchServiceService.getHello();
  }
}
