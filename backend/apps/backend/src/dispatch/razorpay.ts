import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { paymentMode } from './pricing';

export function verifyRazorpayWebhook(raw: Buffer | undefined, signature: string | undefined, secret = process.env.RAZORPAY_WEBHOOK_SECRET) {
  if (!secret) throw new ServiceUnavailableException('Payment verification is not configured');
  if (!raw || !signature || !/^[a-f0-9]{64}$/i.test(signature)) throw new UnauthorizedException('Invalid webhook signature');
  const expected = createHmac('sha256', secret).update(raw).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new UnauthorizedException('Invalid webhook signature');
}
export async function razorpayLink(reference: string, amount: bigint) {
  const key = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret || !process.env.RAZORPAY_WEBHOOK_SECRET) throw new ServiceUnavailableException('Razorpay checkout is not configured yet. Please contact support.');
  const mode = paymentMode();
  if (mode === 'simulation' || !key.startsWith(mode === 'razorpay_test' ? 'rzp_test_' : 'rzp_live_')) throw new ServiceUnavailableException('Razorpay key does not match the configured payment environment');
  const headers = {Authorization: 'Basic ' + Buffer.from(key + ':' + secret).toString('base64'), 'Content-Type': 'application/json'};
  async function api(path: string, body?: unknown) {
    const response = await fetch('https://api.razorpay.com/v1/payment_links/' + path, {method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new ServiceUnavailableException('Payment gateway unavailable. Retry to recover the existing checkout.');
    return response.json();
  }
  // Unique server-owned reference also recovers links created before a timed-out response.
  const found = await api('?reference_id=' + encodeURIComponent(reference));
  let link = found.payment_links?.[0];
  if (!link) {
    try {
      link = await api('', {reference_id: reference, amount: Number(amount), currency: 'INR', accept_partial: false,
        description: 'QuickMechanic job ' + reference, notes: {jobId: reference}, notify: {sms: false, email: false}, reminder_enable: false});
    } catch {
      link = (await api('?reference_id=' + encodeURIComponent(reference))).payment_links?.[0];
      if (!link) throw new ServiceUnavailableException('Checkout could not be created. Please retry.');
    }
  }
  if (link.amount !== Number(amount) || link.currency !== 'INR' || ['expired', 'cancelled'].includes(link.status)) throw new BadRequestException('Checkout requires payment support review');
  const url = new URL(link.short_url);
  if (url.protocol !== 'https:' || !['rzp.io', 'razorpay.com'].some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain))) throw new BadRequestException('Invalid checkout URL');
  return {id: String(link.id), url: url.toString()};
}
