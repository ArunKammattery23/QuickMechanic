import { minorUnits, money, withdrawalWeek } from './money';
describe('Ledger amounts and withdrawal calendar', () => {
  it('keeps decimal currency exact', () => {
    expect(minorUnits('0.10') + minorUnits('0.20')).toBe(30n);
    expect(money(30n)).toBe('0.30');
    expect(() => minorUnits('1.001')).toThrow();
    expect(() => minorUnits('-1')).toThrow();
  });
  it('resets on Monday midnight in India, including the UTC Sunday boundary', () => {
    expect(withdrawalWeek(new Date('2026-09-13T18:29:59Z')).toISOString()).toBe('2026-09-06T18:30:00.000Z');
    expect(withdrawalWeek(new Date('2026-09-13T18:30:00Z')).toISOString()).toBe('2026-09-13T18:30:00.000Z');
  });
});
