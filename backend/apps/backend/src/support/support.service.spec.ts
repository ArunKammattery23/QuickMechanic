import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SupportService, supportAnswer } from './support.service';

describe('support guide', () => {
  it('answers known help topics without claiming to inspect an account', () => {
    expect(supportAnswer('How do I get a refund?').answer).toContain('customer wallet');
    expect(supportAnswer('How can I upload KYC?').suggestedCategory).toBe('KYC');
  });
  it('hands unknown issues to a human ticket', () => {
    expect(supportAnswer('The screen shows a strange code')).toEqual(expect.objectContaining({canCreateTicket:true,suggestedCategory:'OTHER'}));
  });
  it('rejects empty or oversized questions', () => {
    expect(() => supportAnswer('')).toThrow(BadRequestException);
    expect(() => supportAnswer('x'.repeat(501))).toThrow(BadRequestException);
  });
});

describe('ticket access', () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';
  const ticketId = '33333333-3333-4333-8333-333333333333';
  const tickets = {findOneBy: jest.fn().mockResolvedValue({id:ticketId,requesterId:ownerId,requesterRole:'CUSTOMER'})};
  const messages = {find: jest.fn().mockResolvedValue([])};
  const admins = {findOneBy: jest.fn().mockResolvedValue({id:otherId,role:'SUPER_ADMIN'})};
  const service = new SupportService(tickets as any, messages as any, {} as any, admins as any, {} as any);
  it('hides another customer ticket', async () => {
    await expect(service.detail({sub:otherId,role:'CUSTOMER'},ticketId)).rejects.toThrow(NotFoundException);
    expect(messages.find).not.toHaveBeenCalled();
  });
  it('lets the owner and an admin inspect the thread', async () => {
    expect((await service.detail({sub:ownerId,role:'CUSTOMER'},ticketId)).ticket.id).toBe(ticketId);
    expect((await service.detail({sub:otherId,role:'SUPER_ADMIN'},ticketId)).ticket.id).toBe(ticketId);
  });
});
