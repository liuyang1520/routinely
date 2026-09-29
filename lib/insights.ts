import type { State } from './model';
import { addDays, startOfDay } from './schedule';

export function weeklyNote(state: State, now = Date.now()): string | undefined {
  const today = startOfDay(now);
  const daysSinceMonday = (today.getDay() + 6) % 7;
  if (daysSinceMonday > 2) return;
  const thisMonday = addDays(today, -daysSinceMonday).getTime();
  const lastMonday = addDays(thisMonday, -7).getTime();
  const counts = new Map<string, { title: string; count: number }>();
  for (const item of state.occurrences) {
    if (
      item.status !== 'completed' ||
      item.scheduledAt < lastMonday ||
      item.scheduledAt >= thisMonday
    )
      continue;
    const current = counts.get(item.routineId);
    counts.set(item.routineId, { title: item.title, count: (current?.count ?? 0) + 1 });
  }
  const favorite = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  if (!favorite) return;
  return `You made time for ${favorite.title} ${favorite.count} time${favorite.count === 1 ? '' : 's'} last week.`;
}
