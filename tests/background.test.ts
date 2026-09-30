import { beforeEach, expect, it, vi } from 'vitest';
import { emptyState, STORAGE_KEY, type State } from '../lib/model';

const { browser, openOrFocusTab } = vi.hoisted(() => ({
  browser: {
    storage: { local: { get: vi.fn(), set: vi.fn() } },
    windows: { getLastFocused: vi.fn(), onFocusChanged: { addListener: vi.fn() } },
    tabs: {
      onActivated: { addListener: vi.fn() },
      onUpdated: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
    },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() },
    alarms: { create: vi.fn(), clear: vi.fn(), onAlarm: { addListener: vi.fn() } },
    runtime: {
      id: 'routinely-test',
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
      onMessage: { addListener: vi.fn() },
    },
  },
  openOrFocusTab: vi.fn(),
}));
vi.mock('wxt/browser', () => ({ browser }));
vi.mock('wxt/utils/define-background', () => ({ defineBackground: (main: unknown) => ({ main }) }));
vi.mock('../lib/tabs', () => ({ openOrFocusTab, currentWebTab: vi.fn() }));
vi.mock('../lib/navigation-delivery', () => ({
  deliverNavigationNotice: vi.fn(),
  forgetNavigationNotice: vi.fn(),
  queueNavigationNotice: vi.fn(),
}));
import background from '../entrypoints/background';

let state: State;

beforeEach(() => {
  vi.resetAllMocks();
  const now = Date.now();
  state = emptyState(now);
  state.settings.focusExistingTabs = true;
  state.routines = [0, 1, 2].map((index) => ({
    id: `routine-${index}`,
    title: `Routine ${index}`,
    url: `https://example.com/${index}`,
    label: '',
    notes: '',
    enabled: true,
    startAt: now + 86400000,
    createdAt: now,
    schedule: { frequency: 'daily', time: '20:00', days: [1], monthDay: 1, interval: 1 },
  }));
  state.occurrences = state.routines.map((routine) => ({
    id: `due-${routine.id}`,
    routineId: routine.id,
    title: routine.title,
    url: routine.url,
    label: '',
    notes: '',
    scheduledAt: now,
    status: 'pending',
  }));
  browser.storage.local.get.mockImplementation(async () => ({ [STORAGE_KEY]: state }));
  browser.storage.local.set.mockImplementation(async (data) => {
    state = data[STORAGE_KEY];
  });
  browser.windows.getLastFocused.mockResolvedValue({ focused: false });
  openOrFocusTab.mockResolvedValue({ reused: false, tabId: 1 });
});

async function flush() {
  const receive = browser.runtime.onMessage.addListener.mock.calls[0]![0];
  await receive({ type: 'get-state' }, { id: browser.runtime.id });
}

it('opens every due item with focus reserved for the first, after persisting the claims', async () => {
  openOrFocusTab.mockImplementation(async () => {
    expect(state.occurrences.every((item) => item.tabHandledAt !== undefined)).toBe(true);
    return { reused: false, tabId: 1 };
  });
  background.main();
  await flush();
  expect(openOrFocusTab.mock.calls).toEqual([
    ['https://example.com/0', { focus: true }],
    ['https://example.com/1', { focus: false }],
    ['https://example.com/2', { focus: false }],
  ]);
  browser.alarms.onAlarm.addListener.mock.calls[0]![0]({ name: 'routinely-test' });
  await flush();
  expect(openOrFocusTab).toHaveBeenCalledTimes(3);
});

it('continues after an opening fails and retries only the failed item on the next tick', async () => {
  openOrFocusTab.mockRejectedValueOnce(new Error('Could not open tab'));
  background.main();
  await flush();
  expect(openOrFocusTab).toHaveBeenCalledTimes(3);
  expect(state.occurrences.map((item) => item.tabHandledAt !== undefined)).toEqual([
    false,
    true,
    true,
  ]);
  expect(openOrFocusTab).toHaveBeenLastCalledWith('https://example.com/2', { focus: false });
  browser.alarms.onAlarm.addListener.mock.calls[0]![0]({ name: 'routinely-test' });
  await flush();
  expect(openOrFocusTab).toHaveBeenCalledTimes(4);
  expect(openOrFocusTab).toHaveBeenLastCalledWith('https://example.com/0', { focus: true });
  expect(state.occurrences.every((item) => item.tabHandledAt !== undefined)).toBe(true);
});
