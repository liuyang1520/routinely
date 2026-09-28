import { describe, expect, it } from 'vitest';
import { emptyState, type DelayedView, type Occurrence } from '../lib/model';
import { reduceState } from '../lib/reducer';
import { prunableCounts } from '../lib/retention';
import { reconcile } from '../lib/schedule';

const at = (value: string) => new Date(value).getTime();
const now = at('2026-09-28T12:00:00');
const before = at('2026-01-01T00:00:00');

function checkIn(id: string, date: string, status: Occurrence['status']): Occurrence {
  return {
    id,
    routineId: 'routine',
    title: 'Read',
    label: '',
    url: '',
    scheduledAt: at(date),
    status,
    notes: `Notes for ${id}`,
  };
}

function savedPage(id: string, date: string, status: DelayedView['status']): DelayedView {
  return {
    id,
    title: id,
    url: 'https://example.com',
    createdAt: at('2025-01-01T00:00:00'),
    dueAt: at(date),
    status,
  };
}

describe('history cleanup', () => {
  it('removes only finished records before the cutoff and does not recreate them', () => {
    const state = {
      ...emptyState(now),
      scratchpad: 'Keep this',
      routines: [
        {
          id: 'routine',
          title: 'Read',
          url: '',
          label: '',
          notes: 'Keep routine notes',
          schedule: {
            frequency: 'daily' as const,
            time: '10:00',
            days: [],
            monthDay: 1,
            interval: 1,
          },
          enabled: false,
          createdAt: at('2025-01-01T00:00:00'),
          startAt: at('2025-01-01T00:00:00'),
        },
      ],
      occurrences: [
        checkIn('old-done', '2025-01-01T10:00:00', 'completed'),
        checkIn('old-missed', '2025-02-01T10:00:00', 'missed'),
        {
          ...checkIn('old-pending', '2025-03-01T10:00:00', 'pending'),
          snoozedUntil: now + 86400000,
        },
        checkIn('new-done', '2026-02-01T10:00:00', 'completed'),
      ],
      delayedViews: [
        savedPage('old-opened', '2025-01-01T10:00:00', 'opened'),
        savedPage('old-cancelled', '2025-02-01T10:00:00', 'cancelled'),
        savedPage('old-scheduled', '2025-03-01T10:00:00', 'scheduled'),
        savedPage('old-opening', '2025-04-01T10:00:00', 'opening'),
        savedPage('new-opened', '2026-02-01T10:00:00', 'opened'),
      ],
    };

    expect(prunableCounts(state, before)).toEqual({ checkIns: 2, savedPages: 2 });
    const cleaned = reduceState(state, { type: 'prune-history', before }, now);
    expect(cleaned.occurrences.map((item) => item.id)).toEqual(['old-pending', 'new-done']);
    expect(cleaned.delayedViews.map((item) => item.id)).toEqual([
      'old-scheduled',
      'old-opening',
      'new-opened',
    ]);
    expect(cleaned.routines).toEqual(state.routines);
    expect(cleaned.scratchpad).toBe('Keep this');
    expect(prunableCounts(reconcile(cleaned, now + 60000), before)).toEqual({
      checkIns: 0,
      savedPages: 0,
    });
  });

  it('rejects a future cutoff', () => {
    expect(() =>
      reduceState(emptyState(now), { type: 'prune-history', before: now + 86400000 }, now),
    ).toThrow('Choose a date');
  });
});
