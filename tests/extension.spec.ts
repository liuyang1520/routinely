import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Worker,
  type Page,
} from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { emptyState, type State } from '../lib/model';

let context: BrowserContext;
let worker: Worker;
let extensionId: string;
let profile: string;
let server: Server;
let url: string;
const errors: string[] = [];
test.beforeAll(async () => {
  server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<!doctype html><html><head><title>A normal webpage</title></head><body style="font:18px system-ui;padding:60px;background:#f4f6f2"><h1>A normal webpage</h1><p>Your routine reminder should appear here.</p></body></html>',
    );
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  profile = await mkdtemp(join(tmpdir(), 'routinely-test-'));
  const extension = resolve('.output/chrome-mv3');
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  context.on('page', (page) => page.on('pageerror', (e) => errors.push(e.message)));
  context.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = new URL(worker.url()).host;
});
test.afterAll(async () => {
  await context?.close();
  await new Promise<void>((done) => server?.close(() => done()));
  if (profile) await rm(profile, { recursive: true, force: true });
});
async function dashboard(): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/dashboard.html`);
  return page;
}
async function read(): Promise<State> {
  return worker.evaluate(
    async () =>
      (await (globalThis as any).chrome.storage.local.get('routinely-v1'))['routinely-v1'],
  );
}
async function seed(state: State) {
  // Use the same serialized mutation boundary as the product; direct storage writes
  // can race the worker's initialization and would bypass production behavior.
  const page = await dashboard();
  const result = await page.evaluate(
    async (value) =>
      (globalThis as any).chrome.runtime.sendMessage({
        type: 'mutate',
        action: { type: 'import', value },
      }),
    state,
  );
  expect(result.error).toBeUndefined();
  worker = context.serviceWorkers()[0] ?? worker;
  await worker.evaluate(async () => {
    await (globalThis as any).chrome.alarms.create('routinely-test', { when: Date.now() + 200 });
  });
  await page.close();
}

test('create, edit, complete, export, and restore a routine in the real extension', async () => {
  await seed(emptyState());
  const page = await dashboard();
  await expect(
    page.getByRole('heading', { name: 'Good habits. A little at a time.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'New routine N' }).click();
  await page.getByLabel('Routine name').fill('Read something good');
  await page.getByLabel('Link to open').fill('https://news.ycombinator.com');
  await page.getByLabel('At what time?').fill('23:59');
  await page.getByRole('button', { name: 'Add a step' }).click();
  await page
    .getByRole('textbox', { name: 'Step 1', exact: true })
    .fill('Save one interesting idea');
  await page.getByRole('button', { name: 'Create routine', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Read something good', exact: true }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Show details for Read something good' }).click();
  await page.getByLabel('Save one interesting idea').check();
  await page
    .getByLabel('Notes for Read something good')
    .fill('An interesting article about type systems.');
  await page.getByRole('button', { name: 'Mark done', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Undo completion of Read something good' }),
  ).toBeVisible();
  await page.getByRole('textbox', { name: 'Scratchpad' }).fill('A thought to keep.');
  await page.getByRole('button', { name: 'My routines', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Read something good' }).click();
  await page.getByRole('combobox', { name: 'Repeat', exact: true }).selectOption('weekly');
  await page.getByRole('button', { name: 'Weekdays', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Weekdays', { exact: false })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('cell', { name: /Read something good/ })).toBeVisible();
  const state = await read();
  expect(state.routines).toHaveLength(1);
  expect(state.routines[0]?.schedule.days).toEqual([1, 2, 3, 4, 5]);
  expect(state.scratchpad).toBe('A thought to keep.');
  expect(state.occurrences[0]).toMatchObject({
    status: 'completed',
    notes: 'An interesting article about type systems.',
    tasks: [{ done: true }],
  });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export data', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/routinely-backup.*\.json$/);
  const path = await file.path();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Import Routinely backup').setInputFiles(path!);
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Replace and restore' }).click();
  await expect(page.getByText('Your backup has been restored.')).toBeVisible();
  await page.screenshot({ path: 'test-results/settings.png', fullPage: true });
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 420, height: 600 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByRole('heading', { name: 'A little room for today.' })).toBeVisible();
  await expect(popup.getByRole('heading', { name: 'Read something good' })).toBeVisible();
  await popup.screenshot({ path: 'test-results/popup.png', animations: 'disabled' });
  const opened = context.waitForEvent('page');
  await popup.getByRole('button', { name: 'Open dashboard', exact: true }).click();
  const openedDashboard = await opened;
  await openedDashboard.waitForLoadState();
  expect(openedDashboard.url()).toBe(`chrome-extension://${extensionId}/dashboard.html`);
  await openedDashboard.close();
  await popup.close();
  expect(errors).toEqual([]);
  await page.close();
});

test('the actual toolbar popup opens at a readable width', async () => {
  await seed(emptyState());
  const page = await dashboard();
  await worker.evaluate(async () => (globalThis as any).chrome.action.openPopup());
  try {
    await expect
      .poll(() =>
        page.evaluate(() => {
          const popup = (globalThis as any).chrome.extension.getViews({ type: 'popup' })[0];
          return popup?.innerWidth;
        }),
      )
      .toBe(420);
    const dimensions = await page.evaluate(() => {
      const popup = (globalThis as any).chrome.extension.getViews({ type: 'popup' })[0];
      return {
        height: popup.innerHeight,
        contentWidth: popup.document.documentElement.scrollWidth,
        title: popup.document.querySelector('h1')?.textContent,
      };
    });
    expect(dimensions.height).toBeLessThanOrEqual(600);
    expect(dimensions.contentWidth).toBe(420);
    expect(dimensions.title).toBe('A little room for today.');
  } finally {
    await page.evaluate(() => {
      (globalThis as any).chrome.extension.getViews({ type: 'popup' })[0]?.close();
    });
    await page.close();
  }
});

test('theme toggle in popover window synchronizes with the detailed page and vice versa', async () => {
  await seed(emptyState());
  const dashPage = await dashboard();
  const popupPage = await context.newPage();
  await popupPage.setViewportSize({ width: 420, height: 600 });
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

  // Both should start in dark mode by default
  await expect(dashPage.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(popupPage.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Toggle theme to light mode in popup window
  const popupThemeButton = popupPage.getByRole('button', { name: 'Switch to light mode' });
  await expect(popupThemeButton).toBeVisible();
  await popupThemeButton.click();

  // Verify popup switched to light mode
  await expect(popupPage.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(popupPage.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();

  // Verify detailed page (dashboard) automatically switched to light mode
  await expect(dashPage.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(dashPage.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();

  // Toggle theme back to dark mode in detailed page (dashboard)
  const dashThemeButton = dashPage.getByRole('button', { name: 'Switch to dark mode' });
  await dashThemeButton.click();

  // Verify detailed page switched to dark mode
  await expect(dashPage.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(dashPage.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();

  // Verify popup automatically switched to dark mode (vice versa)
  await expect(popupPage.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(popupPage.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();

  // Close and reopen popup to ensure persistence
  await popupPage.close();
  const reopenedPopup = await context.newPage();
  await reopenedPopup.setViewportSize({ width: 420, height: 600 });
  await reopenedPopup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(reopenedPopup.locator('html')).toHaveAttribute('data-theme', 'dark');

  await reopenedPopup.close();
  await dashPage.close();
  expect(errors).toEqual([]);
});

test('alarms show isolated reminders on the active tab; snooze, notes, and completion persist', async () => {
  const now = Date.now();
  const date = new Date(now);
  date.setSeconds(0, 0);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  await seed({
    ...emptyState(date.getTime() - 60000),
    routines: [
      {
        id: 'alarm-test',
        title: 'Alarm test routine',
        url: `${url}/article`,
        category: 'Learning',
        notes: 'A small note.',
        tasks: [{ id: 'step', title: 'Read a little' }],
        schedule: { frequency: 'daily', time, days: [1], monthDay: 1, interval: 1 },
        enabled: true,
        startAt: date.getTime() - 60000,
        createdAt: date.getTime() - 60000,
      },
    ],
  });
  const first = await context.newPage();
  await first.goto(url);
  await first.bringToFront();
  await expect(first.getByRole('region', { name: 'Routinely reminder' })).toBeVisible();
  await expect(first.getByRole('heading', { name: 'Alarm test routine' })).toBeVisible();
  await first.getByLabel('Read a little').check();
  await first.getByLabel('Notes for Alarm test routine').fill('A note from the floating panel.');
  await first.getByRole('button', { name: '10 min', exact: true }).click();
  await expect(first.getByRole('region', { name: 'Routinely reminder' })).toHaveCount(0);
  let state = await read();
  expect(state.occurrences).toHaveLength(1);
  expect(state.occurrences[0]?.snoozedUntil).toBeGreaterThan(now);
  expect(state.occurrences[0]?.notes).toBe('A note from the floating panel.');
  state.occurrences[0]!.snoozedUntil = Date.now() - 1;
  await seed(state);
  await expect(first.getByRole('region', { name: 'Routinely reminder' })).toBeVisible();
  const second = await context.newPage();
  await second.goto(`${url}/other`);
  await second.bringToFront();
  await expect(second.getByRole('region', { name: 'Routinely reminder' })).toBeVisible();
  await expect(first.getByRole('region', { name: 'Routinely reminder' })).toHaveCount(0);
  await expect(second.getByLabel('Read a little')).toBeChecked();
  expect(await second.evaluate(() => getComputedStyle(document.body).fontSize)).toBe('18px');
  const newTab = context.waitForEvent('page');
  await second.getByRole('link', { name: 'Open Alarm test routine' }).click();
  const article = await newTab;
  await article.waitForURL(`${url}/article`);
  expect(article.url()).toBe(`${url}/article`);
  expect((await read()).occurrences[0]?.status).toBe('pending');
  await article.close();
  await second.bringToFront();
  await expect(second.getByRole('region', { name: 'Routinely reminder' })).toBeVisible();
  await second.screenshot({ path: 'test-results/floating-reminder.png', animations: 'disabled' });
  await second.getByRole('button', { name: 'Mark done', exact: true }).click();
  await expect(second.getByRole('region', { name: 'Routinely reminder' })).toHaveCount(0);
  state = await read();
  expect(state.occurrences[0]).toMatchObject({
    status: 'completed',
    tasks: [{ done: true }],
    notes: 'A note from the floating panel.',
  });
  const page = await dashboard();
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('cell', { name: /Alarm test routine/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: /completed/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/activity.png', fullPage: true });
  expect(errors).toEqual([]);
  await page.close();
  await first.close();
  await second.close();
});

test('the popup saves the current webpage and the later queue supports rescheduling and cancel', async () => {
  await seed(emptyState());
  const target = await context.newPage();
  await target.goto(`${url}/save-for-later`);
  await target.bringToFront();
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 420, height: 600 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText('A normal webpage', { exact: true })).toBeVisible();
  await popup.screenshot({ path: 'test-results/quick-delay.png', animations: 'disabled' });
  const before = Date.now();
  await popup.getByRole('button', { name: '1 hour', exact: true }).click();
  await expect(popup.getByText('A little space for later.')).toBeVisible();
  let state = await read();
  expect(state.delayedViews[0]?.url).toBe(`${url}/save-for-later`);
  expect(state.delayedViews[0]!.dueAt).toBeGreaterThanOrEqual(before + 3600000);
  expect(state.delayedViews[0]!.dueAt).toBeLessThan(Date.now() + 3600000);
  await popup.getByRole('button', { name: 'Undo delayed view' }).click();
  await expect(popup.getByRole('button', { name: '3 hours', exact: true })).toBeVisible();
  expect((await read()).delayedViews).toHaveLength(0);
  await popup.getByRole('button', { name: '3 hours', exact: true }).click();
  await expect(popup.getByText('A little space for later.')).toBeVisible();
  const dashboardPage = await dashboard();
  await dashboardPage.getByRole('button', { name: 'View later', exact: true }).click();
  await expect(dashboardPage.getByRole('heading', { name: 'A normal webpage' })).toBeVisible();
  await dashboardPage.getByRole('button', { name: 'Reschedule A normal webpage' }).click();
  await dashboardPage.getByRole('button', { name: '1 day', exact: true }).click();
  await expect(dashboardPage.getByRole('dialog')).toHaveCount(0);
  state = await read();
  expect(state.delayedViews[0]!.dueAt).toBeGreaterThan(Date.now() + 86300000);
  await dashboardPage.screenshot({
    path: 'test-results/view-later.png',
    fullPage: true,
    animations: 'disabled',
  });
  await dashboardPage.getByRole('button', { name: 'Cancel A normal webpage' }).click();
  await expect(dashboardPage.getByRole('heading', { name: 'Already brought back' })).toBeVisible();
  expect((await read()).delayedViews[0]?.status).toBe('cancelled');
  expect(errors).toEqual([]);
  await popup.close();
  await dashboardPage.close();
  await target.close();
});

test('opening a routine reuses an existing exact URL, including across windows', async () => {
  await seed(emptyState());
  const page = await dashboard();
  const targetUrl = `${url}/same-page?view=1#section`;
  const created = await worker.evaluate(
    async (address) => (globalThis as any).chrome.windows.create({ url: address, focused: false }),
    targetUrl,
  );
  await expect
    .poll(async () =>
      (await worker.evaluate(async () => (globalThis as any).chrome.tabs.query({}))).some(
        (tab: any) => tab.url === targetUrl,
      ),
    )
    .toBe(true);
  await page.bringToFront();
  expect(
    await worker.evaluate(
      async () => (await (globalThis as any).chrome.windows.getLastFocused()).id,
    ),
  ).not.toBe(created.id);
  const countBefore = (await worker.evaluate(async () => (globalThis as any).chrome.tabs.query({})))
    .length;
  const opened = await page.evaluate(
    async (address) =>
      (globalThis as any).chrome.runtime.sendMessage({ type: 'open-link', url: address }),
    targetUrl,
  );
  expect(opened.reused).toBe(true);
  expect(
    (await worker.evaluate(async () => (globalThis as any).chrome.tabs.query({}))).length,
  ).toBe(countBefore);
  const active = await worker.evaluate(
    async () =>
      (await (globalThis as any).chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0],
  );
  expect(active.url).toBe(targetUrl);
  expect(active.windowId).toBe(created.id);
  const different = await page.evaluate(
    async (address) =>
      (globalThis as any).chrome.runtime.sendMessage({ type: 'open-link', url: address }),
    `${url}/same-page?view=2#section`,
  );
  expect(different.reused).toBe(false);
  await worker.evaluate(async (id) => (globalThis as any).chrome.windows.remove(id), created.id);
  await page.close();
  expect(errors).toEqual([]);
});

test('delayed views focus an existing tab, reopen a closed page, and run only once', async () => {
  const initial = emptyState();
  initial.settings.reminders = false;
  await seed(initial);
  const target = await context.newPage();
  await target.goto(`${url}/delayed-existing`);
  const control = await dashboard();
  const schedule = async (id: string, address: string) => {
    const now = Date.now();
    const result = await control.evaluate(
      async ({ id, address, now }) =>
        (globalThis as any).chrome.runtime.sendMessage({
          type: 'mutate',
          action: {
            type: 'add-delayed-view',
            item: {
              id,
              title: 'Delayed test page',
              url: address,
              createdAt: now,
              dueAt: now + 1500,
              status: 'scheduled',
            },
          },
        }),
      { id, address, now },
    );
    expect(result.error).toBeUndefined();
  };
  const countBefore = (await worker.evaluate(async () => (globalThis as any).chrome.tabs.query({})))
    .length;
  await schedule('existing-tab', `${url}/delayed-existing`);
  await expect
    .poll(async () => (await read()).delayedViews.find((v) => v.id === 'existing-tab')?.status)
    .toBe('opened');
  expect(
    (await worker.evaluate(async () => (globalThis as any).chrome.tabs.query({}))).length,
  ).toBe(countBefore);
  expect(
    await worker.evaluate(
      async () =>
        (await (globalThis as any).chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
          .url,
    ),
  ).toBe(`${url}/delayed-existing`);
  const toast = target.getByRole('complementary', { name: 'Why Routinely opened this page' });
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Switched to this tab for “Delayed test page”.');
  await expect(toast).toContainText('You saved it for');
  await expect(target.getByRole('region', { name: 'Routinely reminder' })).toHaveCount(0);
  await target.screenshot({ path: 'test-results/delayed-view-toast.png', animations: 'disabled' });
  await expect(toast).toHaveCount(0, { timeout: 12000 });
  await control.bringToFront();
  await target.bringToFront();
  await expect(toast).toHaveCount(0);
  await target.close();
  await control.bringToFront();
  await schedule('closed-tab', `${url}/delayed-existing`);
  await expect
    .poll(async () => (await read()).delayedViews.find((v) => v.id === 'closed-tab')?.status)
    .toBe('opened');
  expect(
    (await worker.evaluate(async () => (globalThis as any).chrome.tabs.query({}))).filter(
      (tab: any) => tab.url === `${url}/delayed-existing`,
    ),
  ).toHaveLength(1);
  const reopened = context.pages().find((page) => page.url() === `${url}/delayed-existing`)!;
  const openedToast = reopened.getByRole('complementary', {
    name: 'Why Routinely opened this page',
  });
  await expect(openedToast).toBeVisible();
  await expect(openedToast).toContainText('Opened this tab for “Delayed test page”.');
  await reopened.getByRole('button', { name: 'Dismiss navigation notice' }).click();
  await expect(openedToast).toHaveCount(0);
  const openedAt = (await read()).delayedViews.find((v) => v.id === 'closed-tab')?.openedAt;
  await control.bringToFront();
  await worker.evaluate(async () =>
    (globalThis as any).chrome.alarms.create('routinely-test', { when: Date.now() + 100 }),
  );
  await expect.poll(async () => (await read()).lastTick).toBeGreaterThan(openedAt!);
  expect((await read()).delayedViews.find((v) => v.id === 'closed-tab')?.openedAt).toBe(openedAt);
  expect(
    await worker.evaluate(
      async () =>
        (await (globalThis as any).chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
          .url,
    ),
  ).toContain('/dashboard.html');
  expect(errors).toEqual([]);
  await reopened.close();
  await control.close();
});

test('a navigation explanation waits for a newly opened page to finish loading', async () => {
  await seed(emptyState());
  const control = await dashboard();
  const destination = `${url}/slow-navigation`;
  let release!: () => void;
  const responseReady = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route(destination, async (route) => {
    await responseReady;
    await route.fulfill({ contentType: 'text/html', body: '<h1>A slow page</h1>' });
  });
  try {
    const newPage = context.waitForEvent('page');
    const result = await control.evaluate(
      async (address) =>
        (globalThis as any).chrome.runtime.sendMessage({ type: 'open-link', url: address }),
      destination,
    );
    const key = `routinely-navigation-${result.tabId}`;
    expect(
      await worker.evaluate(
        async (key) => (await (globalThis as any).chrome.storage.session.get(key))[key],
        key,
      ),
    ).toBeTruthy();
    release();
    const page = await newPage;
    await page.waitForLoadState();
    const toast = page.getByRole('complementary', { name: 'Why Routinely opened this page' });
    await expect(toast).toContainText('Opened this tab from Routinely.');
    await expect
      .poll(() =>
        worker.evaluate(
          async (key) => (await (globalThis as any).chrome.storage.session.get(key))[key],
          key,
        ),
      )
      .toBeUndefined();
    await expect(page.getByRole('region', { name: 'Routinely reminder' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Dismiss navigation notice' }).click();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'A slow page' })).toBeVisible();
    await expect(toast).toHaveCount(0);
    await page.close();
    expect(errors).toEqual([]);
  } finally {
    release();
    await context.unroute(destination);
    await control.close();
  }
});

test('a due routine switches to its existing tab only once', async () => {
  await seed(emptyState());
  const target = await context.newPage();
  await target.goto(`${url}/routine-existing`);
  const now = Date.now();
  const date = new Date(now);
  date.setSeconds(0, 0);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  await seed({
    ...emptyState(date.getTime() - 60000),
    routines: [
      {
        id: 'focus-test',
        title: 'Focus an existing tab',
        url: `${url}/routine-existing`,
        category: 'Learning',
        notes: '',
        tasks: [],
        schedule: { frequency: 'daily', time, days: [1], monthDay: 1, interval: 1 },
        enabled: true,
        startAt: date.getTime() - 60000,
        createdAt: date.getTime() - 60000,
      },
    ],
  });
  await expect.poll(async () => (await read()).occurrences[0]?.tabHandledAt).toBeTruthy();
  expect(
    await worker.evaluate(
      async () =>
        (await (globalThis as any).chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
          .url,
    ),
  ).toBe(`${url}/routine-existing`);
  const toast = target.getByRole('complementary', { name: 'Why Routinely opened this page' });
  const reminder = target.getByRole('region', { name: 'Routinely reminder' });
  await expect(toast).toContainText('Switched to this tab for “Focus an existing tab”.');
  await expect(reminder).toBeVisible();
  const toastBox = (await toast.boundingBox())!;
  const reminderBox = (await reminder.boundingBox())!;
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(reminderBox.y);
  await target.screenshot({ path: 'test-results/routine-with-toast.png', animations: 'disabled' });
  const page = await dashboard();
  await page.bringToFront();
  await expect(
    page.getByRole('heading', { name: 'Good habits. A little at a time.' }),
  ).toBeVisible();
  expect(
    await worker.evaluate(
      async () =>
        (await (globalThis as any).chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
          .url,
    ),
  ).toContain('/dashboard.html');
  expect((await read()).occurrences[0]?.status).toBe('pending');
  const countBefore = (await worker.evaluate(async () => (globalThis as any).chrome.tabs.query({})))
    .length;
  await page.getByRole('link', { name: 'Open Focus an existing tab', exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await worker.evaluate(async () =>
            (globalThis as any).chrome.tabs.query({ active: true, lastFocusedWindow: true }),
          )
        )[0].url,
    )
    .toBe(`${url}/routine-existing`);
  expect(
    (await worker.evaluate(async () => (globalThis as any).chrome.tabs.query({}))).length,
  ).toBe(countBefore);
  expect(errors).toEqual([]);
  await target.close();
  await page.close();
});

test('a scheduled alarm appears without navigating or interacting with the page', async () => {
  test.setTimeout(90000);
  const now = Date.now();
  const scheduledAt = Math.ceil((now + 3000) / 60000) * 60000;
  const date = new Date(scheduledAt);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  await seed({
    ...emptyState(now),
    routines: [
      {
        id: 'scheduled-alarm',
        title: 'A scheduled check-in',
        url: '',
        category: 'Personal',
        notes: '',
        tasks: [],
        enabled: true,
        createdAt: now,
        startAt: now,
        schedule: { frequency: 'daily', time, days: [1], monthDay: 1, interval: 1 },
      },
    ],
  });
  const page = await context.newPage();
  await page.goto(url);
  await page.bringToFront();
  await expect(page.getByRole('region', { name: 'Routinely reminder' })).toHaveCount(0);
  const alarm = await worker.evaluate(async () =>
    (globalThis as any).chrome.alarms.get('routinely-next'),
  );
  expect(alarm.scheduledTime).toBe(scheduledAt);
  await expect(page.getByRole('heading', { name: 'A scheduled check-in' })).toBeVisible({
    timeout: 75000,
  });
  expect((await read()).occurrences[0]?.scheduledAt).toBe(scheduledAt);
  expect(errors).toEqual([]);
  await page.close();
});

test('reloading the extension retires reminders in already-open webpages without errors', async () => {
  // Command-line loading bypasses the developer-mode requirement on first
  // launch, but Chrome enforces it on reload, just like Load unpacked.
  const manager = await context.newPage();
  await manager.goto('chrome://extensions');
  await manager.evaluate(async () => {
    await (globalThis as any).chrome.developerPrivate.updateProfileConfiguration({
      inDeveloperMode: true,
    });
  });
  await manager.close();
  const now = Date.now();
  await seed({
    ...emptyState(now),
    routines: [
      {
        id: 'reload-routine',
        title: 'Reload check',
        category: 'Personal',
        url: '',
        notes: '',
        tasks: [],
        enabled: true,
        createdAt: now,
        startAt: now,
        schedule: { frequency: 'daily', time: '23:59', days: [1], monthDay: 1, interval: 1 },
      },
    ],
    occurrences: [
      {
        id: 'reload-check',
        routineId: 'reload-routine',
        title: 'Reload check',
        category: 'Personal',
        url: '',
        scheduledAt: now,
        status: 'pending',
        notes: '',
        tasks: [],
      },
    ],
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const exceptions: string[] = [];
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    exceptions.push(exceptionDetails.exception?.description ?? exceptionDetails.text);
  });
  await cdp.send('Runtime.enable');
  await page.goto(`${url}/reload-check`);
  await page.bringToFront();
  await expect(page.getByRole('heading', { name: 'Reload check' })).toBeVisible();
  await worker.evaluate(() => {
    setTimeout(() => (globalThis as any).chrome.runtime.reload(), 0);
  });
  // Exercise the stale script, including the synchronous API-throw path that
  // a Promise.catch on sendMessage alone cannot handle.
  await expect
    .poll(async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
      });
      return page.locator('routinely-reminder').count();
    })
    .toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(await page.evaluate(() => localStorage.getItem('routinely-v1'))).toBeNull();
  expect(exceptions).toEqual([]);
  expect(errors).toEqual([]);
  const control = await context.newPage();
  // runtime.reload is asynchronous; wait for Chrome to re-enable the extension
  // before refreshing the webpage so its content script is injected again.
  await expect
    .poll(async () => {
      try {
        await control.goto(`chrome-extension://${extensionId}/dashboard.html`);
        return true;
      } catch {
        return false;
      }
    })
    .toBe(true);
  await expect(
    control.getByRole('heading', { name: 'Good habits. A little at a time.' }),
  ).toBeVisible();
  await page.reload();
  await page.bringToFront();
  await expect(page.getByRole('heading', { name: 'Reload check' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark done', exact: true }).click();
  await expect
    .poll(() =>
      control.evaluate(async () => {
        const response = await (globalThis as any).chrome.runtime.sendMessage({
          type: 'get-state',
        });
        return response.state.occurrences[0]?.status;
      }),
    )
    .toBe('completed');
  await control.close();
  await cdp.detach();
  expect(exceptions).toEqual([]);
  expect(errors).toEqual([]);
  await page.close();
});
