import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

// Capture README screenshots of the production extension with illustrative data.
// The disposable browser profile never accesses personal extension data.
const output = resolve('assets/screenshots');
const extension = resolve('.output/chrome-mv3');
await readFile(join(extension, 'manifest.json'));
await mkdir(output, { recursive: true });
const server = createServer((_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Reading room — sample page</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f7f5f0;color:#28312d;font:18px/1.8 Georgia,serif}
    header{padding:22px 56px;border-bottom:1px solid #dfdfd7;font:600 16px system-ui;letter-spacing:.02em}
    main{max-width:680px;margin:70px 0 0 76px;padding-right:90px}h1{font-size:44px;line-height:1.15;font-weight:500}
    .label{font:12px system-ui;color:#63796c;letter-spacing:.15em}p{color:#58635c}hr{border:0;border-top:1px solid #d8ddd5;margin:32px 0}
    </style></head><body><header>Reading room</header><main><div class="label">READING &amp; LEARNING</div><h1>Make room for a good idea.</h1>
    <p>A few minutes of focused reading can be enough to find something worth remembering.</p><hr>
    <p>Choose a chapter, a saved article, or a subject you have been curious about. Read at your own pace, then jot down one idea to return to.</p>
    <p>This is a sample reading page for demonstrating Routinely’s in-page reminder.</p></main></body></html>`);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), 'routinely-screenshots-'));
let context;
const errors = [];
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  context.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const id = new URL(worker.url()).host;
  const dashboard = await context.newPage();
  await dashboard.goto(`chrome-extension://${id}/dashboard.html`);
  const now = Date.now();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const minute = (hours, minutes = 0) => midnight.getTime() + (hours * 60 + minutes) * 60000;
  const routine = (id, title, label, time, url = '') => ({
    id,
    title,
    label,
    url,
    notes: '',
    enabled: true,
    createdAt: now,
    startAt: now,
    schedule: { frequency: 'daily', time, days: [1, 2, 3, 4, 5], monthDay: 1, interval: 1 },
  });
  const routines = [
    routine('read', 'Read a chapter', 'Learning', '20:00', `${baseUrl}/reading`),
    routine('stretch', 'Take a stretch break', 'Wellbeing', '09:30'),
    routine('plan', 'Plan tomorrow', 'Personal', '21:00'),
    routine('language', 'Practice Spanish', 'Learning', '18:00'),
  ];
  const occurrence = (r, date, status = 'pending', notes = '') => ({
    id: `${r.id}:${new Date(date).getFullYear()}-${String(new Date(date).getMonth() + 1).padStart(2, '0')}-${String(new Date(date).getDate()).padStart(2, '0')}:${r.schedule.time}`,
    routineId: r.id,
    title: r.title,
    label: r.label,
    url: r.url,
    scheduledAt: date,
    status,
    notes,
    ...(status === 'completed' ? { completedAt: date + 600000 } : {}),
  });
  const state = {
    version: 1,
    routines,
    occurrences: [
      occurrence(routines[0], now - 60000),
      occurrence(routines[1], minute(9, 30), 'completed', 'Five minutes away from the screen.'),
      occurrence(routines[2], Math.max(minute(21), now + 3600000)),
      occurrence(routines[3], minute(18), 'completed', 'Reviewed everyday phrases.'),
    ],
    delayedViews: [
      {
        id: 'design',
        title: 'A guide to thoughtful interface design',
        url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development',
        createdAt: now,
        dueAt: now + 3600000,
        status: 'scheduled',
      },
      {
        id: 'chrome',
        title: 'Chrome extension documentation',
        url: 'https://developer.chrome.com/docs/extensions/',
        createdAt: now,
        dueAt: now + 86400000,
        status: 'scheduled',
      },
    ],
    settings: {
      reminders: true,
      reminderNotes: true,
      position: 'top-right',
      focusExistingTabs: false,
    },
    scratchpad: '',
    lastTick: now,
  };
  for (let days = 1; days <= 27; days++) {
    const date = new Date(midnight);
    date.setDate(date.getDate() - days);
    for (const [index, r] of routines.entries()) {
      date.setHours(9 + index * 3, 0, 0, 0);
      state.occurrences.push(
        occurrence(
          r,
          date.getTime(),
          (days + index) % 9 === 0 ? 'skipped' : (days + index) % 13 === 0 ? 'missed' : 'completed',
        ),
      );
    }
  }
  const imported = await dashboard.evaluate(async (value) => {
    await chrome.storage.local.set({ 'routinely-theme': 'light' });
    return chrome.runtime.sendMessage({ type: 'mutate', action: { type: 'import', value } });
  }, state);
  if (imported.error) throw new Error(imported.error);
  await dashboard.reload();
  async function capture(page, filename) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(output, filename), animations: 'disabled', type: 'png' });
    console.log(`Captured ${filename}`);
  }
  await expect(dashboard.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await capture(dashboard, 'homepage.png');

  const reading = await context.newPage();
  await reading.goto(`${baseUrl}/reading`);
  await reading.bringToFront();
  const panel = reading.getByRole('region', { name: 'Routinely reminder' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('textbox')).toBeEmpty();
  await capture(reading, 'floating-window.png');

  const popup = await context.newPage();
  await popup.setViewportSize({ width: 420, height: 590 });
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await expect(popup.getByRole('tab', { name: /Today/ })).toBeVisible();
  await popup.evaluate(() => document.fonts.ready);
  await popup.locator('.popup').screenshot({
    path: join(output, 'extension-popover.png'),
    animations: 'disabled',
    type: 'png',
  });
  console.log('Captured extension-popover.png');
  if (errors.length) throw new Error(`Browser errors: ${errors.join('\n')}`);

  const websiteAssets = resolve('docs/assets');
  await mkdir(websiteAssets, { recursive: true });
  for (const filename of ['homepage.png', 'floating-window.png', 'extension-popover.png']) {
    await copyFile(join(output, filename), join(websiteAssets, filename));
  }
} finally {
  await context?.close();
  await new Promise((done) => server.close(done));
  await rm(profile, { recursive: true, force: true });
}
