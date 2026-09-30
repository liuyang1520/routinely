import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

// Capture the production extension with illustrative data in a disposable profile.
// No product DOM, styles, or screenshots are modified for the listing.
const output = resolve('docs/chrome-web-store/assets');
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
const profile = await mkdtemp(join(tmpdir(), 'routinely-store-'));
let context;
const errors = [];
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
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
    id: `${r.id}-${date}`,
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
    await chrome.storage.local.set({ 'routinely-theme': 'dark' });
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
  await capture(dashboard, '01-today.png');
  await dashboard.getByRole('button', { name: 'My routines', exact: true }).click();
  await capture(dashboard, '02-routines.png');
  const reading = await context.newPage();
  await reading.goto(`${baseUrl}/reading`);
  await reading.bringToFront();
  const panel = reading.getByRole('region', { name: 'Routinely reminder' });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('border-top-left-radius', '24px');
  await expect(panel.getByRole('textbox')).toHaveAttribute('placeholder', 'Add a note…');
  await expect(panel.getByRole('textbox')).toBeEmpty();
  await expect(panel.getByRole('textbox')).toHaveCSS('border-top-width', '0px');
  await expect(
    panel.getByRole('button', { name: 'Expand notes for Read a chapter' }),
  ).toBeVisible();
  await capture(reading, '03-floating-reminder.png');
  await dashboard.bringToFront();
  await dashboard.getByRole('button', { name: 'View later', exact: true }).click();
  await capture(dashboard, '04-view-later.png');
  await dashboard.getByRole('button', { name: 'Activity', exact: true }).click();
  await capture(dashboard, '05-activity.png');
  await dashboard.getByRole('button', { name: 'Settings', exact: true }).click();
  await capture(dashboard, '06-settings.png');
  await dashboard.getByRole('switch', { name: 'Notes in floating reminders' }).click();
  await reading.bringToFront();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('textbox')).toHaveCount(0);
  await capture(reading, '07-floating-reminder-without-notes.png');
  await reading.close();

  // Store promotional art uses the existing vector icon, rendered by Chromium.
  const icon = await readFile(resolve('public/icon.svg'), 'utf8');
  const promo = await context.newPage();
  await promo.setViewportSize({ width: 440, height: 280 });
  await promo.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box}body{margin:0;width:440px;height:280px;background:#101916;display:grid;place-items:center}
    main{position:relative;width:440px;height:280px;display:grid;place-items:center;background:radial-gradient(ellipse at center,#234939 0%,#101916 72%);overflow:hidden}
    .ring{position:absolute;width:220px;height:220px;border:1px solid #34d39944;border-radius:50%}.ring.outer{width:310px;height:310px;border-color:#34d39922}
    svg{position:relative;width:154px;height:154px;filter:drop-shadow(0 12px 24px #0005)}
    </style></head><body><main><div class="ring outer"></div><div class="ring"></div>${icon}</main></body></html>`);
  await capture(promo, 'promo-small-440x280.png');
  const iconBytes = await readFile(resolve('public/icon/128.png'));
  await promo.setViewportSize({ width: 128, height: 128 });
  await promo.setContent(
    `<html><body style="margin:0;width:128px;height:128px;display:grid;place-items:center"><img width="96" height="96" src="data:image/png;base64,${iconBytes.toString('base64')}" alt="Routinely"></body></html>`,
  );
  await promo.locator('img').evaluate((image) => image.decode());
  await promo.screenshot({ path: join(output, 'icon-128.png'), omitBackground: true });
  if (errors.length) throw new Error(`Browser errors: ${errors.join('\n')}`);
  await writeFile(
    join(output, 'capture.json'),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        extensionVersion: '1.0.0',
        viewport: { width: 1280, height: 800 },
        source:
          'Production Chrome MV3 extension loaded in isolated Chromium; illustrative data and local sample reading page.',
        screenshots: [
          '01-today.png',
          '02-routines.png',
          '03-floating-reminder.png',
          '04-view-later.png',
          '05-activity.png',
          '06-settings.png',
          '07-floating-reminder-without-notes.png',
        ],
        browserErrors: errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await context?.close();
  await new Promise((done) => server.close(done));
  await rm(profile, { recursive: true, force: true });
}
