import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { emptyState, stateSchema, STORAGE_KEY, type State } from '../lib/model';
import { dueItems, nextOccurrence, reconcile } from '../lib/schedule';
import { reduceState } from '../lib/reducer';
import { currentWebTab, openOrFocusTab } from '../lib/tabs';
import {
  deliverNavigationNotice,
  forgetNavigationNotice,
  queueNavigationNotice,
} from '../lib/navigation-delivery';
import type { NavigationReason } from '../lib/navigation-notice';
import { normalizedPageUrl } from '../lib/urls';

export default defineBackground(() => {
  // All writes go through this queue, including alarms and messages from different tabs.
  let queue = Promise.resolve();
  let lastVisibleTab: number | undefined;
  async function explainNavigation(
    result: { tabId?: number; reused: boolean },
    reason: NavigationReason,
  ) {
    try {
      await queueNavigationNotice(result, reason);
    } catch {
      // An unavailable toast must not retry an already successful tab opening.
    }
  }
  function serial<T>(fn: () => Promise<T>): Promise<T> {
    const result = queue.then(fn);
    queue = result.then(
      () => {},
      (error) => console.error('Routinely:', error),
    );
    return result;
  }
  async function load(): Promise<State> {
    const data = (await browser.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
    return data ? stateSchema.parse(data) : emptyState();
  }
  async function activeTab() {
    const win = await browser.windows.getLastFocused();
    if (!win.focused) return;
    return (await browser.tabs.query({ active: true, windowId: win.id }))[0];
  }
  async function sendPanel(tabId: number, visible: boolean, state: State) {
    try {
      await browser.tabs.sendMessage(tabId, { type: 'panel-state', visible, state });
    } catch {
      /* Browser-owned pages and tabs opened before installation have no content script. */
    }
  }
  async function present(state: State) {
    const tab = await activeTab();
    const tabId = tab?.id;
    if (lastVisibleTab !== undefined && lastVisibleTab !== tabId)
      await sendPanel(lastVisibleTab, false, state);
    lastVisibleTab = tabId;
    const due = dueItems(state);
    await browser.action.setBadgeText({ text: due.length ? String(due.length) : '' });
    await browser.action.setBadgeBackgroundColor({ color: '#42694e' });
    if (tab && tabId !== undefined) {
      const address = tab.pendingUrl || tab.url;
      const items = due.filter((item) => {
        if (tab.incognito) return false;
        if (!item.url) return true;
        return !!address && normalizedPageUrl(item.url) === normalizedPageUrl(address);
      });
      // The panel paginates its state, so scope the contents as well as visibility.
      await sendPanel(tabId, state.settings.reminders && items.length > 0, {
        ...state,
        occurrences: items,
      });
    }
  }
  async function save(state: State) {
    await browser.storage.local.set({ [STORAGE_KEY]: state });
    const now = Date.now();
    const times = state.routines.flatMap((r) => {
      const next = nextOccurrence(r, now + 1);
      return next ? [next.scheduledAt] : [];
    });
    times.push(
      ...state.occurrences
        .filter((o) => o.status === 'pending' && o.snoozedUntil && o.snoozedUntil > now)
        .map((o) => o.snoozedUntil!),
    );
    times.push(
      ...state.routines.flatMap((r) => (!r.enabled && r.pausedUntil ? [r.pausedUntil] : [])),
    );
    times.push(
      ...state.delayedViews
        .filter((v) => v.status === 'scheduled' || v.status === 'opening')
        .map((v) => Math.max(v.dueAt, v.retryAt ?? 0)),
    );
    if (times.length)
      await browser.alarms.create('routinely-next', {
        when: Math.max(now + 1000, Math.min(...times)),
      });
    else await browser.alarms.clear('routinely-next');
    await present(state);
  }
  async function deliverTabs(state: State): Promise<State> {
    const now = Date.now();
    if (state.settings.reminders && state.settings.focusExistingTabs) {
      const items = dueItems(state, now).filter((o) => o.url && o.tabHandledAt === undefined);
      if (items.length) {
        // Claim before activation: onActivated/focus events must not keep switching
        // the user back while the same reminder is still pending.
        const ids = new Set(items.map((o) => o.id));
        state = {
          ...state,
          occurrences: state.occurrences.map((o) =>
            ids.has(o.id) ? { ...o, tabHandledAt: now } : o,
          ),
        };
        await browser.storage.local.set({ [STORAGE_KEY]: state });
        // One focus change per batch avoids cycling through several due tabs.
        const item = items[0]!;
        try {
          await openOrFocusTab(item.url);
        } catch {
          // Let the next tick retry if the destination could not be opened.
          state = {
            ...state,
            occurrences: state.occurrences.map((o) =>
              ids.has(o.id) ? { ...o, tabHandledAt: undefined } : o,
            ),
          };
          await browser.storage.local.set({ [STORAGE_KEY]: state });
        }
      }
    }
    for (const item of state.delayedViews) {
      if (
        !['scheduled', 'opening'].includes(item.status) ||
        item.dueAt > now ||
        (item.retryAt ?? 0) > now
      )
        continue;
      // Recoverable claim. If the worker restarts mid-open, tab matching reuses
      // the tab already created instead of opening it a second time.
      state = {
        ...state,
        delayedViews: state.delayedViews.map((v) =>
          v.id === item.id ? { ...v, status: 'opening' } : v,
        ),
      };
      await browser.storage.local.set({ [STORAGE_KEY]: state });
      try {
        const result = await openOrFocusTab(item.url);
        await explainNavigation(result, {
          kind: 'delayed-view',
          title: item.title,
          scheduledAt: item.dueAt,
        });
        state = {
          ...state,
          delayedViews: state.delayedViews.map((v) =>
            v.id === item.id
              ? {
                  ...v,
                  status: 'opened',
                  openedAt: Date.now(),
                  retryAt: undefined,
                  error: undefined,
                }
              : v,
          ),
        };
      } catch {
        state = {
          ...state,
          delayedViews: state.delayedViews.map((v) =>
            v.id === item.id
              ? {
                  ...v,
                  status: 'scheduled',
                  retryAt: Date.now() + 60000,
                  error: 'Could not open this page. Retrying in one minute.',
                }
              : v,
          ),
        };
      }
      await browser.storage.local.set({ [STORAGE_KEY]: state });
    }
    return state;
  }
  async function tick() {
    const state = await deliverTabs(reconcile(await load()));
    await save(state);
    return state;
  }
  async function initialize() {
    await browser.alarms.create('routinely-heartbeat', { periodInMinutes: 1 });
    await tick();
  }
  browser.runtime.onInstalled.addListener(() => {
    void serial(initialize);
  });
  browser.runtime.onStartup.addListener(() => {
    void serial(initialize);
  });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith('routinely-')) void serial(tick);
  });
  browser.tabs.onActivated.addListener(() => {
    void serial(tick);
  });
  browser.tabs.onUpdated.addListener((_tabId, change) => {
    // Includes same-document navigation, where the content script stays mounted.
    if (change.url) void serial(async () => present(reconcile(await load())));
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    void serial(() => forgetNavigationNotice(tabId));
  });
  browser.windows.onFocusChanged.addListener(() => {
    void serial(tick);
  });
  browser.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== browser.runtime.id) return;
    if (message.type === 'current-tab')
      return currentWebTab()
        .then((tab) => ({ tab }))
        .catch(() => ({ error: 'Could not read the current tab.' }));
    if (message.type === 'open-link')
      return serial(async () => {
        const result = await openOrFocusTab(message.url);
        await explainNavigation(result, { kind: 'link', title: '' });
        return result;
      }).catch(() => ({
        error: 'Could not open this page. Please try again.',
      }));
    if (message.type === 'open-dashboard')
      return browser.tabs
        .create({ url: browser.runtime.getURL('/dashboard.html') })
        .then(() => ({ ok: true }));
    if (message.type === 'get-state')
      return serial(async () => ({ state: reconcile(await load()) })).catch(() => ({
        error: 'Your saved data could not be read. Please reload the extension.',
      }));
    if (message.type === 'panel-ready')
      return serial(async () => {
        await present(reconcile(await load()));
        if (sender.tab?.id !== undefined && sender.frameId === 0)
          await deliverNavigationNotice(sender.tab.id);
        return { ok: true };
      });
    if (message.type === 'mutate')
      return serial(async () => {
        const state = reduceState(await load(), message.action);
        await save(state);
        return { state };
      }).catch((error) => ({
        error: error instanceof Error ? error.message : 'Could not save changes.',
      }));
  });
  void serial(initialize);
});
