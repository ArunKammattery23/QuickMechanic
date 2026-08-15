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
    it('should return "Hello World!"', () => {
      expect(dispatchServiceController.getHello()).toBe('Hello World!');
    });
  });
});
