import { describe, expect, it } from 'vitest';
import { emptyState, type DelayedView } from '../lib/model';
import { reduceState } from '../lib/reducer';
import { parseBackup } from '../lib/export';
import { normalizedPageUrl } from '../lib/urls';

const now = new Date('2026-09-15T10:00:00').getTime();
const page: DelayedView = {
  id: 'later',
  title: 'An article',
  url: 'https://example.com/article',
  createdAt: now,
  dueAt: now + 3600000,
  status: 'scheduled',
};

describe('one-off delayed views', () => {
  it('stores an exact duration and includes the page in full backups', () => {
    const state = reduceState(emptyState(now), { type: 'add-delayed-view', item: page }, now);
    expect(state.delayedViews[0]!.dueAt - now).toBe(3600000);
    expect(parseBackup(JSON.stringify(state)).delayedViews).toEqual(state.delayedViews);
  });
  it('rejects past times and unsafe links', () => {
    expect(() =>
      reduceState(
        emptyState(now),
        { type: 'add-delayed-view', item: { ...page, dueAt: now - 1 } },
        now,
      ),
    ).toThrow('future');
    expect(() =>
      reduceState(
        emptyState(now),
        { type: 'add-delayed-view', item: { ...page, url: 'javascript:alert(1)' } },
        now,
      ),
    ).toThrow();
  });
  it('supports cancel, reschedule, open now, and removing history', () => {
    let state = reduceState(emptyState(now), { type: 'add-delayed-view', item: page }, now);
    state = reduceState(state, { type: 'cancel-delayed-view', id: page.id }, now);
    expect(state.delayedViews[0]?.status).toBe('cancelled');
    state = reduceState(
      state,
      { type: 'reschedule-delayed-view', id: page.id, dueAt: now + 86400000 },
      now,
    );
    expect(state.delayedViews[0]).toMatchObject({ status: 'scheduled', dueAt: now + 86400000 });
    state = reduceState(state, { type: 'mark-delayed-opened', id: page.id }, now);
    expect(state.delayedViews[0]).toMatchObject({ status: 'opened', openedAt: now });
    state = reduceState(state, { type: 'remove-delayed-view', id: page.id }, now);
    expect(state.delayedViews).toHaveLength(0);
  });
  it('migrates older v1 backups without losing existing data', () => {
    const legacy = {
      ...emptyState(now),
      scratchpad: 'Keep this',
      delayedViews: undefined,
      settings: { reminders: true, position: 'top-right' },
    };
    const migrated = parseBackup(JSON.stringify(legacy));
    expect(migrated.scratchpad).toBe('Keep this');
    expect(migrated.delayedViews).toEqual([]);
    expect(migrated.settings.focusExistingTabs).toBe(false);
    expect(migrated.settings.reminderNotes).toBe(true);
    const disabled = { ...migrated, settings: { ...migrated.settings, reminderNotes: false } };
    expect(parseBackup(JSON.stringify(disabled)).settings.reminderNotes).toBe(false);
  });
});
describe('tab URL matching', () => {
  it('normalizes host case, default ports, and root slashes', () => {
    expect(normalizedPageUrl('https://EXAMPLE.com:443')).toBe(
      normalizedPageUrl('https://example.com/'),
    );
  });
  it('keeps different paths, queries, protocols, and fragment routes separate', () => {
    const base = normalizedPageUrl('https://example.com/article?a=1#intro');
    for (const url of [
      'https://example.com/other?a=1#intro',
      'https://example.com/article?a=2#intro',
      'https://example.com/article?a=1#other',
      'http://example.com/article?a=1#intro',
    ])
      expect(normalizedPageUrl(url)).not.toBe(base);
  });
});
