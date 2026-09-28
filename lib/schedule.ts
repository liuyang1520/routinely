import type { Occurrence, Routine, Schedule, State } from './model';

export function dayKey(date: Date | number): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function startOfDay(value: Date | number): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}
export function addDays(value: Date | number, n: number): Date {
  const d = new Date(value);
  d.setDate(d.getDate() + n);
  return d;
}
function dayNumber(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
}
export function occursOn(routine: Routine, day: Date): boolean {
  if (!routine.enabled || dayNumber(day) < dayNumber(new Date(routine.startAt))) return false;
  const s = routine.schedule;
  if (s.frequency === 'weekly') return s.days.includes(day.getDay());
  if (s.frequency === 'monthly') {
    const lastDay = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
    return day.getDate() === Math.min(s.monthDay, lastDay);
  }
  if (s.frequency === 'interval')
    return (dayNumber(day) - dayNumber(new Date(routine.startAt))) % s.interval === 0;
  return true;
}
export function occurrenceOn(routine: Routine, day: Date): Occurrence | undefined {
  if (!occursOn(routine, day)) return;
  const scheduled = startOfDay(day);
  const [hours, minutes] = routine.schedule.time.split(':').map(Number);
  scheduled.setHours(hours!, minutes!, 0, 0);
  if (scheduled.getTime() < routine.startAt) return;
  return {
    id: `${routine.id}:${dayKey(day)}:${routine.schedule.time}`,
    routineId: routine.id,
    title: routine.title,
    label: routine.label,
    url: routine.url,
    scheduledAt: scheduled.getTime(),
    status: 'pending',
    notes: routine.notes,
  };
}
export function forDay(state: State, day: Date): Occurrence[] {
  const persisted = state.occurrences.filter((o) => dayKey(o.scheduledAt) === dayKey(day));
  const ids = new Set(persisted.map((o) => o.id));
  const planned = state.routines.flatMap((r) => {
    const o = occurrenceOn(r, day);
    return o && !ids.has(o.id) ? [o] : [];
  });
  return [...persisted, ...planned].sort((a, b) => a.scheduledAt - b.scheduledAt);
}
export function nextOccurrence(routine: Routine, now = Date.now()): Occurrence | undefined {
  for (let i = 0; i <= 366; i++) {
    const o = occurrenceOn(routine, addDays(now, i));
    if (o && o.scheduledAt >= now) return o;
  }
}
export function reconcile(state: State, now = Date.now()): State {
  const occurrences = [...state.occurrences];
  const ids = new Set(occurrences.map((o) => o.id));
  for (const routine of state.routines) {
    if (!routine.enabled) continue;
    // Calendar arithmetic, not 24h offsets, keeps recurrence stable through DST.
    for (
      let day = startOfDay(Math.max(state.lastTick, routine.startAt));
      day.getTime() <= now;
      day = addDays(day, 1)
    ) {
      const occurrence = occurrenceOn(routine, day);
      if (occurrence && occurrence.scheduledAt <= now && !ids.has(occurrence.id)) {
        occurrences.push(occurrence);
        ids.add(occurrence.id);
      }
    }
  }
  return {
    ...state,
    lastTick: now,
    occurrences: occurrences.map((o) =>
      o.status === 'pending' &&
      now - o.scheduledAt >= 86400000 &&
      (!o.snoozedUntil || o.snoozedUntil <= now)
        ? { ...o, status: 'missed' }
        : o,
    ),
  };
}
export const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function scheduleLabel(s: Schedule): string {
  if (s.frequency === 'daily') return 'Every day';
  if (s.frequency === 'monthly') return `Monthly · day ${s.monthDay}`;
  if (s.frequency === 'interval') return `Every ${s.interval} day${s.interval === 1 ? '' : 's'}`;
  if ([1, 2, 3, 4, 5].every((d) => s.days.includes(d)) && s.days.length === 5) return 'Weekdays';
  if (s.days.length === 7) return 'Every day';
  return s.days.map((d) => weekDays[d]).join(', ');
}
export function timeLabel(value: number | string): string {
  const date = typeof value === 'string' ? new Date(`2000-01-01T${value}:00`) : new Date(value);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
export function dueItems(state: State, now = Date.now()): Occurrence[] {
  return state.occurrences
    .filter(
      (o) =>
        o.status === 'pending' &&
        o.scheduledAt <= now &&
        (!o.snoozedUntil || o.snoozedUntil <= now) &&
        state.routines.some((r) => r.id === o.routineId && r.enabled),
    )
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
}

export const AUTO_CHECK_DELAY_MS = 3000;
