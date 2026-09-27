import { KycStatus, MechanicProfile } from '@app/common/entities/mechanic-profile.entity';
import { requireProviderEligibility, validProviderMobile } from './provider-eligibility';

describe('provider job eligibility', () => {
  const profile = {kycStatus: KycStatus.APPROVED, kycDocumentsVerified: true} as MechanicProfile;

  it('requires a properly filled mobile number', () => {
    expect(validProviderMobile('9876543210')).toBe(true);
    expect(validProviderMobile('+919876543210')).toBe(true);
    for (const mobile of ['', 'Unknown', '12345']) {
      expect(() => requireProviderEligibility(profile, mobile)).toThrow('mobile number');
    }
  });

  it('requires approved KYC before a provider can accept work', () => {
    expect(() => requireProviderEligibility({kycStatus: KycStatus.PENDING} as MechanicProfile, '9876543210')).toThrow('Complete KYC');
    expect(() => requireProviderEligibility({kycStatus: KycStatus.REJECTED} as MechanicProfile, '9876543210')).toThrow('Complete KYC');
    expect(() => requireProviderEligibility({kycStatus: KycStatus.APPROVED, kycDocumentsVerified: false} as MechanicProfile, '9876543210')).toThrow('Complete KYC');
    expect(() => requireProviderEligibility(profile, '9876543210')).not.toThrow();
  });
});
