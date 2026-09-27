import { ForbiddenException } from '@nestjs/common';
import { KycStatus, MechanicProfile } from '@app/common/entities/mechanic-profile.entity';

// Accept a domestic 10-digit mobile or an international E.164-style number.
export function validProviderMobile(value: unknown): value is string {
  return typeof value === 'string' && /^\+?[1-9]\d{9,14}$/.test(value.trim());
}

export function requireProviderEligibility(profile: MechanicProfile | null | undefined, phone: unknown): void {
  if (!validProviderMobile(phone)) {
    throw new ForbiddenException('Add a valid mobile number in your provider profile before taking jobs.');
  }
  if (!profile || profile.kycStatus !== KycStatus.APPROVED || !profile.kycDocumentsVerified) {
    throw new ForbiddenException('Complete KYC and wait for admin approval before taking jobs.');
  }
}
