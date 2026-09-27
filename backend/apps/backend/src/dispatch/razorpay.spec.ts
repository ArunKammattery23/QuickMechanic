import { createHmac } from 'crypto';
import { verifyRazorpayWebhook } from './razorpay';
describe('Razorpay webhook authentication', () => {
  const raw = Buffer.from('{"event":"payment_link.paid"}');
  const signature = createHmac('sha256', 'test-secret').update(raw).digest('hex');
  it('accepts the signed raw bytes', () => {
    expect(() => verifyRazorpayWebhook(raw, signature, 'test-secret')).not.toThrow();
  });
  it('rejects modified bodies, bad signatures and missing configuration', () => {
    expect(() => verifyRazorpayWebhook(Buffer.from('{}'), signature, 'test-secret')).toThrow();
    expect(() => verifyRazorpayWebhook(raw, 'bad', 'test-secret')).toThrow();
    expect(() => verifyRazorpayWebhook(raw, signature, '')).toThrow();
  });
});
