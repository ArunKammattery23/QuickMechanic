import { Test, TestingModule } from '@nestjs/testing';
import { UsersServiceController } from './users-service.controller';
import { UsersServiceService } from './users-service.service';

describe('UsersServiceController', () => {
  let usersServiceController: UsersServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [UsersServiceController],
      providers: [UsersServiceService],
    }).compile();

    usersServiceController = app.get<UsersServiceController>(UsersServiceController);
  });

  it('exposes the legacy pending-KYC service response', async () => {
    expect(await usersServiceController.getPendingMechanics()).toEqual([
      expect.objectContaining({kycStatus: 'PENDING'}),
    ]);
  });
});
