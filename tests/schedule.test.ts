import { describe, expect, it } from 'vitest';
import { emptyState, type Routine } from '../lib/model';
import {
  addDays,
  dayKey,
  dueItems,
  forDay,
  nextOccurrence,
  occurrenceOn,
  reconcile,
} from '../lib/schedule';
import { reduceState } from '../lib/reducer';
import { historyCsv, parseBackup } from '../lib/export';

const at = (value: string) => new Date(value).getTime();
function routine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: 'news',
    title: 'Read Hacker News',
    url: 'https://news.ycombinator.com',
    category: 'Learning',
    notes: 'One good idea',
    tasks: [{ id: 'read', title: 'Read a story' }],
    enabled: true,
    createdAt: at('2026-03-01T00:00:00'),
    startAt: at('2026-03-01T00:00:00'),
    schedule: { frequency: 'daily', time: '21:00', days: [1], monthDay: 31, interval: 2 },
    ...overrides,
  };
}

describe('local calendar scheduling', () => {
  it('moves daily reminders to tomorrow after today’s scheduled time', () => {
    expect(nextOccurrence(routine(), at('2026-03-02T22:00:00'))?.scheduledAt).toBe(
      at('2026-03-03T21:00:00'),
    );
  });
  it('schedules only selected weekdays', () => {
    const r = routine();
    r.schedule = { ...r.schedule, frequency: 'weekly', days: [1, 3] };
    expect(occurrenceOn(r, new Date('2026-03-03T12:00:00'))).toBeUndefined();
    expect(nextOccurrence(r, at('2026-03-03T12:00:00'))?.scheduledAt).toBe(
      at('2026-03-04T21:00:00'),
    );
  });
  it('clamps monthly dates to the last day of a short month', () => {
    const r = routine();
    r.schedule = { ...r.schedule, frequency: 'monthly', monthDay: 31 };
    expect(nextOccurrence(r, at('2026-04-01T00:00:00'))?.scheduledAt).toBe(
      at('2026-04-30T21:00:00'),
    );
  });
  it('uses calendar days for every-N-day schedules across daylight saving', () => {
    const r = routine({ startAt: at('2026-03-07T00:00:00') });
    r.schedule = { ...r.schedule, frequency: 'interval', interval: 2 };
    expect(occurrenceOn(r, new Date('2026-03-09T00:00:00'))?.scheduledAt).toBe(
      at('2026-03-09T21:00:00'),
    );
    expect(occurrenceOn(r, new Date('2026-03-08T00:00:00'))).toBeUndefined();
  });
  it('keeps daily wall-clock time through spring and fall DST changes', () => {
    const r = routine();
    expect(occurrenceOn(r, new Date('2026-03-08T00:00:00'))?.scheduledAt).toBe(
      at('2026-03-08T21:00:00'),
    );
    expect(occurrenceOn(r, new Date('2026-11-01T00:00:00'))?.scheduledAt).toBe(
      at('2026-11-01T21:00:00'),
    );
    expect(dayKey(addDays(new Date('2026-03-08T00:00:00'), 1))).toBe('2026-03-09');
  });
  it('does not create a reminder before the routine was saved', () => {
    expect(
      occurrenceOn(
        routine({ startAt: at('2026-03-02T22:00:00') }),
        new Date('2026-03-02T12:00:00'),
      ),
    ).toBeUndefined();
  });
  it('creates only one occurrence during repeated fall-back hours', () => {
    const r = routine();
    r.schedule.time = '01:30';
    let state = { ...emptyState(at('2026-11-01T00:00:00-07:00')), routines: [r] };
    state = reconcile(state, at('2026-11-01T01:45:00-07:00'));
    state = reconcile(state, at('2026-11-01T01:45:00-08:00'));
    expect(state.occurrences).toHaveLength(1);
  });
});
describe('durable check-ins', () => {
  it('catches up after downtime, expires old reminders, and deduplicates ticks', () => {
    const state = { ...emptyState(at('2026-03-01T20:00:00')), routines: [routine()] };
    const recovered = reconcile(state, at('2026-03-04T22:00:00'));
    expect(recovered.occurrences).toHaveLength(4);
    expect(recovered.occurrences.filter((o) => o.status === 'missed')).toHaveLength(3);
    expect(dueItems(recovered, at('2026-03-04T22:00:00'))).toHaveLength(1);
    expect(reconcile(recovered, at('2026-03-04T22:01:00')).occurrences).toHaveLength(4);
  });
  it('lets users complete today early and preserves it when the alarm fires', () => {
    const state = { ...emptyState(at('2026-03-02T10:00:00')), routines: [routine()] };
    const item = forDay(state, new Date('2026-03-02T10:00:00'))[0]!;
    const updated = reduceState(
      state,
      { type: 'complete', id: item.id },
      at('2026-03-02T10:00:00'),
    );
    const later = reconcile(updated, at('2026-03-02T22:00:00'));
    expect(later.occurrences).toHaveLength(1);
    expect(later.occurrences[0]?.status).toBe('completed');
    expect(dueItems(later, at('2026-03-02T22:00:00'))).toHaveLength(0);
  });
  it('snoozes for ten minutes and restores the same checklist and note', () => {
    const now = at('2026-03-02T21:00:00');
    let state = reconcile({ ...emptyState(now), routines: [routine()] }, now);
    const id = state.occurrences[0]!.id;
    state = reduceState(state, { type: 'task', id, taskId: 'read', done: true }, now);
    state = reduceState(state, { type: 'note', id, value: 'Saved a story' }, now);
    state = reduceState(state, { type: 'snooze', id }, now);
    expect(dueItems(state, now + 9 * 60000)).toHaveLength(0);
    expect(dueItems(state, now + 10 * 60000)[0]).toMatchObject({
      notes: 'Saved a story',
      tasks: [{ id: 'read', done: true }],
    });
  });
  it('editing and deleting a routine preserve completed history', () => {
    const now = at('2026-03-02T21:00:00');
    let state = reconcile({ ...emptyState(now), routines: [routine()] }, now);
    const id = state.occurrences[0]!.id;
    state = reduceState(state, { type: 'complete', id }, now);
    state = reduceState(
      state,
      { type: 'save-routine', routine: routine({ title: 'New title' }) },
      now,
    );
    state = reduceState(state, { type: 'delete-routine', id: 'news' }, now);
    expect(state.routines).toHaveLength(0);
    expect(state.occurrences[0]).toMatchObject({ title: 'Read Hacker News', status: 'completed' });
  });
  it('does not backfill paused days on resume', () => {
    const now = at('2026-03-02T20:00:00');
    let state = { ...emptyState(now), routines: [routine()] };
    state = reduceState(state, { type: 'toggle-routine', id: 'news' }, now);
    state = reduceState(state, { type: 'toggle-routine', id: 'news' }, at('2026-03-06T20:00:00'));
    state = reconcile(state, at('2026-03-06T22:00:00'));
    expect(state.occurrences).toHaveLength(1);
    expect(dayKey(state.occurrences[0]!.scheduledAt)).toBe('2026-03-06');
  });
  it('rejects future-day actions instead of creating fake check-ins', () => {
    const now = at('2026-03-02T10:00:00');
    const state = { ...emptyState(now), routines: [routine()] };
    const id = forDay(state, new Date('2026-03-03T10:00:00'))[0]!.id;
    expect(() => reduceState(state, { type: 'complete', id }, now)).toThrow('no longer available');
  });
});
describe('portable data', () => {
  it('round-trips all user data in a JSON backup', () => {
    const state = { ...emptyState(), routines: [routine()], scratchpad: 'Remember this' };
    expect(parseBackup(JSON.stringify(state))).toEqual(state);
  });
  it('rejects unsafe links, duplicate IDs, and unsupported versions', () => {
    expect(() =>
      parseBackup(
        JSON.stringify({ ...emptyState(), routines: [routine({ url: 'javascript:alert(1)' })] }),
      ),
    ).toThrow();
    expect(() =>
      parseBackup(JSON.stringify({ ...emptyState(), routines: [routine(), routine()] })),
    ).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...emptyState(), version: 2 }))).toThrow();
  });
  it('escapes quotes, newlines, and formula prefixes in CSV', () => {
    const now = at('2026-03-02T21:00:00');
    const state = reconcile(
      {
        ...emptyState(now),
        routines: [routine({ title: '=HYPERLINK("bad")', notes: 'one, two\nthree' })],
      },
      now,
    );
    expect(historyCsv(state)).toContain('"\'=HYPERLINK(""bad"")"');
    expect(historyCsv(state)).toContain('"one, two\nthree"');
  });
});
