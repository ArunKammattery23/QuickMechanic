import { performanceBadges } from './performance';
describe('Performance badges', () => {
  it('does not grant fabricated badges to new providers', () => {
    expect(performanceBadges(0, 0, 0)).toEqual([]);
    expect(performanceBadges(0, 1, 5)).toEqual([]);
  });
  it('requires sufficient service history and reviews for top performer', () => {
    expect(performanceBadges(100, 50, 4.8).map(b => b.name)).toContain('Top Performer');
    expect(performanceBadges(100, 49, 4.8).map(b => b.name)).not.toContain('Top Performer');
    expect(performanceBadges(100, 50, 4.7).map(b => b.name)).not.toContain('Top Performer');
  });
});
