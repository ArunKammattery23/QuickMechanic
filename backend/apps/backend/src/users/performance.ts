export function performanceBadges(completed: number, reviews: number, average: number) {
  const badges: { name: string; description: string }[] = [];
  for (const [count, name] of [[10, 'Reliable Starter'], [100, 'Bronze Wrench'], [500, 'Silver Wrench'], [1000, 'Gold Wrench']] as const) {
    if (completed >= count) badges.push({ name, description: `${count} completed services` });
  }
  if (reviews >= 10 && average >= 4.5) badges.push({ name: 'Customer Favourite', description: 'At least 10 reviews and a 4.5+ average' });
  if (completed >= 100 && reviews >= 50 && average >= 4.8) badges.push({ name: 'Top Performer', description: '100 completed services, 50 reviews and a 4.8+ average' });
  return badges;
}
