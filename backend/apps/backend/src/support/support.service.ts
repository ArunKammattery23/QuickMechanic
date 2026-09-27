import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  SupportTicket,
  SupportMessage,
} from '@app/common/entities/support-ticket.entity';
import { ServiceRequest } from '@app/common/entities/service-request.entity';
import { AdmUser } from '@app/common/entities/adm-user.entity';

const adminRoles = ['SUPER_ADMIN', 'MANAGER', 'CEO'];
const userRoles = ['CUSTOMER', 'MECHANIC', 'FLEET_DRIVER'];
const categories = ['JOB', 'PAYMENT', 'KYC', 'ACCOUNT', 'APP', 'OTHER'];
const statuses = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_USER',
  'RESOLVED',
  'CLOSED',
];
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function supportAnswer(question: unknown) {
  if (typeof question !== 'string' || !question.trim() || question.length > 500)
    throw new BadRequestException('Enter a question (up to 500 characters)');
  const q = question
    .toLowerCase()
    .replace(/[^a-z0-9+ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const has = (...terms: string[]) => terms.some((term) => q.includes(term));
  let answer: string | null = null;
  if (
    has(
      'dummy payment',
      'test payment',
      'razorpay',
      'cashfree',
      'payment method',
      'payment gateway',
    )
  ) {
    answer =
      'The app may use a demo payment flow during testing. A demo success confirms the test job flow only; it does not mean a real bank or wallet transfer occurred. Check Wallet and history for recorded transactions, and create a Payment ticket if anything looks incorrect.';
  } else if (has('refund', 'money back', 'cancel', 'cancellation')) {
    answer =
      'If a job is cancelled before the customer confirms completion, the held payment is returned to the customer wallet. If the wallet does not update, create a Payment ticket and include the Job ID.';
  } else if (
    has(
      'withdraw',
      'withdrawal',
      'payout',
      'wallet',
      'earnings',
      'payment',
      'pay',
    )
  ) {
    answer =
      'Open Settings → Wallet and history to review transactions. Provider earnings are released after the customer confirms completion, minus the configured provider commission. Providers can request up to five withdrawals per Monday–Sunday week. For a missing transaction, create a Payment ticket with the Job ID.';
  } else if (
    has(
      'kyc',
      'identity',
      'verify',
      'verification',
      'document',
      'id card',
      'aadhaar',
      'licence',
      'license',
      'passport',
    )
  ) {
    answer =
      'Providers submit the front and back of a government ID, full address and secondary phone in Profile → Identity verification. The submission stays saved during admin review; upload again only if it is rejected. Admin approval is required before taking jobs.';
  } else if (has('route', 'map', 'location', 'gps', 'distance', 'directions')) {
    answer =
      'Allow precise location access and keep GPS and internet enabled. Reopen the active job to refresh the route. If the route or distance is still wrong, create a Job ticket and include the Job ID.';
  } else if (has('call', 'calling', 'phone', 'audio', 'microphone', 'hear')) {
    answer =
      'Allow the requested phone and microphone permissions, and confirm both phones have internet access. If the in-app call still fails, create an App ticket with the Job ID.';
  } else if (
    has(
      'login',
      'sign in',
      'signin',
      'password',
      '401',
      'account',
      'otp',
      'code',
    )
  ) {
    answer =
      'Use the customer or provider app that matches your account and sign in with its registered email or phone. Check your connection and try again. If sign-in still fails, create an Account ticket. Never share a password or one-time code.';
  } else if (
    has(
      'service config',
      'service configuration',
      'services not visible',
      'pricing',
      'price',
      'go online',
      'online',
      'commission',
      'provider profile',
    )
  ) {
    answer =
      'Providers need to select at least one service and save its price in Service configuration before going online. The provider can review the commission while setting prices; customers see the final quotation, not a separate commission line. If configuration does not load, refresh and create an App ticket if it continues.';
  } else if (
    has(
      'available service',
      'available services',
      'what services',
      'service type',
      'services list',
      'services do you offer',
    )
  ) {
    answer =
      'Choose a service that matches your vehicle issue from the customer home screen, confirm your pickup location and send the request. Nearby online providers who offer that service can respond.';
  } else if (
    has(
      'platform fee',
      'travel fee',
      'travel charge',
      'distance charge',
      'per km',
      'quotation amount',
      'commission',
    )
  ) {
    answer =
      'Customers see the final quotation and any platform fee before confirming payment. Travel is calculated from route distance using current admin pricing rules. Provider commission is shown to the provider while setting service prices, not as a separate customer charge.';
  } else if (
    has(
      'no provider',
      'provider not found',
      'nobody accepted',
      'request failed',
      'request not sent',
      'send request',
    )
  ) {
    answer =
      'Check location permission and confirm your pickup point, then retry. If a previous request may still be active, open Active job and check its status before sending another. If no provider is found, try again shortly or create a Job ticket.';
  } else if (has('rating', 'review', 'badge', 'performance')) {
    answer =
      'Customers can rate and review a provider after a completed job. Provider badges reflect verified profile details and service performance and update as eligible reviews and completed jobs are recorded.';
  } else if (
    has(
      'profile',
      'mobile number',
      'phone number',
      'change number',
      'edit details',
    )
  ) {
    answer =
      'Open Profile or Settings to review your account details. Providers must keep a valid mobile number and complete KYC before accepting jobs. Create an Account ticket if you cannot update a detail.';
  } else if (has('complete', 'completion', 'finished', 'done')) {
    answer =
      'After the provider marks the job complete, the customer must confirm completion in the app. That confirmation finalizes the job and releases the provider earnings from escrow according to the configured commission.';
  } else if (has('ticket', 'support', 'help', 'agent', 'human')) {
    answer =
      'Choose “Raise a support ticket”, select the closest issue type and explain what happened. Add the Job ID when relevant. Open the ticket later from this page to see its status and replies.';
  } else if (
    has(
      'job',
      'request',
      'booking',
      'mechanic',
      'provider',
      'accept',
      'quotation',
      'quote',
    )
  ) {
    answer =
      'After a customer sends a request, the provider reviews and accepts it. The customer then reviews the quotation and payment and confirms the job. Check Active job for its current status; if a job is stuck or missing, create a Job ticket with its Job ID.';
  }
  const suggestedCategory = has(
    'refund',
    'payment',
    'wallet',
    'withdraw',
    'payout',
    'pay',
  )
    ? 'PAYMENT'
    : has('kyc', 'identity', 'verification', 'document')
      ? 'KYC'
      : has('job', 'booking', 'request', 'quotation', 'quote')
        ? 'JOB'
        : has('login', 'password', 'account', 'otp', '401')
          ? 'ACCOUNT'
          : 'OTHER';
  return {
    answer:
      answer ??
      'I could not find a reliable answer for that question. Please create a support ticket and our team will review it.',
    canCreateTicket: true,
    suggestedCategory,
  };
}

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly tickets: Repository<SupportTicket>,
    @InjectRepository(SupportMessage)
    private readonly messages: Repository<SupportMessage>,
    @InjectRepository(ServiceRequest)
    private readonly jobs: Repository<ServiceRequest>,
    @InjectRepository(AdmUser) private readonly admins: Repository<AdmUser>,
    private readonly db: DataSource,
  ) {}

  private assertUser(user: any) {
    if (!userRoles.includes(user.role) || !uuid.test(user.sub))
      throw new ForbiddenException();
  }
  private async assertAdmin(user: any) {
    if (!adminRoles.includes(user.role) || !uuid.test(user.sub))
      throw new ForbiddenException();
    const admin = await this.admins.findOneBy({ id: user.sub });
    if (!admin || admin.role !== user.role)
      throw new ForbiddenException(
        'Admin access requires a current administrator account',
      );
  }
  private text(value: unknown, label: string, max: number) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
      throw new BadRequestException(
        `${label} is required (up to ${max} characters)`,
      );
    return value.trim();
  }

  async create(user: any, body: any) {
    this.assertUser(user);
    const subject = this.text(body?.subject, 'Subject', 120);
    const message = this.text(body?.message, 'Message', 4000);
    const category = this.text(body?.category, 'Category', 32).toUpperCase();
    if (!categories.includes(category))
      throw new BadRequestException('Invalid category');
    const jobId = body?.jobId ? this.text(body.jobId, 'Job ID', 36) : null;
    if (jobId) {
      if (!uuid.test(jobId)) throw new BadRequestException('Invalid Job ID');
      const job = await this.jobs.findOne({
        where: { id: jobId },
        relations: { customer: true, mechanic: true },
      });
      if (
        !job ||
        (user.role === 'CUSTOMER'
          ? job.customer?.id !== user.sub
          : job.mechanic?.id !== user.sub)
      )
        throw new BadRequestException('Job ID is not linked to your account');
    }
    return this.db.transaction(async (manager) => {
      const ticket = await manager.save(
        SupportTicket,
        manager.create(SupportTicket, {
          requesterId: user.sub,
          requesterRole: user.role,
          subject,
          category,
          status: 'OPEN',
          jobId,
        }),
      );
      await manager.save(
        SupportMessage,
        manager.create(SupportMessage, {
          ticketId: ticket.id,
          senderId: user.sub,
          senderRole: user.role,
          body: message,
        }),
      );
      return ticket;
    });
  }

  async listMine(user: any) {
    this.assertUser(user);
    return this.tickets.find({
      where: { requesterId: user.sub, requesterRole: user.role },
      order: { updatedAt: 'DESC' },
      take: 100,
    });
  }
  async listAdmin(user: any, status?: string) {
    await this.assertAdmin(user);
    if (status && !statuses.includes(status))
      throw new BadRequestException('Invalid status');
    return this.tickets.find({
      where: status ? { status } : {},
      order: { updatedAt: 'DESC' },
      take: 100,
    });
  }
  async detail(user: any, id: string) {
    if (!uuid.test(id)) throw new BadRequestException('Invalid ticket ID');
    const ticket = await this.tickets.findOneBy({ id });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (adminRoles.includes(user.role)) await this.assertAdmin(user);
    else if (
      ticket.requesterId !== user.sub ||
      ticket.requesterRole !== user.role
    )
      throw new NotFoundException('Ticket not found');
    return {
      ticket,
      messages: await this.messages.find({
        where: { ticketId: id },
        order: { createdAt: 'ASC', id: 'ASC' },
        take: 500,
      }),
    };
  }
  async reply(user: any, id: string, body: unknown) {
    const text = this.text(body, 'Message', 4000);
    const { ticket } = await this.detail(user, id);
    if (ticket.status === 'CLOSED')
      throw new BadRequestException('This ticket is closed');
    const admin = adminRoles.includes(user.role);
    if (!admin) this.assertUser(user);
    return this.db.transaction(async (manager) => {
      const message = await manager.save(
        SupportMessage,
        manager.create(SupportMessage, {
          ticketId: id,
          senderId: user.sub,
          senderRole: user.role,
          body: text,
        }),
      );
      await manager.update(
        SupportTicket,
        { id },
        {
          status: admin ? 'WAITING_FOR_USER' : 'OPEN',
          assignedAdminId: admin ? user.sub : ticket.assignedAdminId,
          updatedAt: new Date(),
        },
      );
      return message;
    });
  }
  async updateStatus(user: any, id: string, value: unknown) {
    await this.assertAdmin(user);
    const status = this.text(value, 'Status', 20).toUpperCase();
    if (!statuses.includes(status))
      throw new BadRequestException('Invalid status');
    await this.detail(user, id);
    await this.tickets.update({ id }, { status, assignedAdminId: user.sub });
    return this.detail(user, id);
  }
}
