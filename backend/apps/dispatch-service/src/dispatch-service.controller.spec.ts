import { Test, TestingModule } from '@nestjs/testing';
import { DispatchServiceController } from './dispatch-service.controller';
import { DispatchServiceService } from './dispatch-service.service';

describe('DispatchServiceController', () => {
  let dispatchServiceController: DispatchServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [DispatchServiceController],
      providers: [DispatchServiceService],
    }).compile();

    dispatchServiceController = app.get<DispatchServiceController>(DispatchServiceController);
  });

  describe('root', () => {
    it('identifies the legacy service as a prototype without calling a removed method', () => {
      expect(dispatchServiceController.getHello()).toMatchObject({service: 'dispatch-service', status: 'prototype'});
    });
  });
});
