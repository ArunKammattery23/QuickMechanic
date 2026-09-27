import { BadRequestException } from '@nestjs/common';
export function minorUnits(value: unknown): bigint {
  const text = String(value);
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) throw new BadRequestException('Invalid INR amount');
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function money(value: bigint | string): string {
  const n = BigInt(value); return `${n / 100n}.${(n % 100n).toString().padStart(2, '0')}`;
}
export function withdrawalWeek(now = new Date()): Date {
  const india = new Date(now.getTime() + 330 * 60000);
  const days = (india.getUTCDay() + 6) % 7;
  india.setUTCDate(india.getUTCDate() - days);
  india.setUTCHours(0, 0, 0, 0);
  return new Date(india.getTime() - 330 * 60000);
}
