import { Controller, Get } from '@nestjs/common';
import { DispatchServiceService } from './dispatch-service.service';

@Controller()
export class DispatchServiceController {
  constructor(private readonly dispatchServiceService: DispatchServiceService) {}

  @Get()
  getHello() {
    return {service: 'dispatch-service', status: 'prototype', message: 'Use the backend application for production dispatch.'};
  }
}
