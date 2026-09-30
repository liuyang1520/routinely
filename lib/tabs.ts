import { browser } from 'wxt/browser';
import { safeUrl } from './model';
import { normalizedPageUrl } from './urls';
export async function openOrFocusTab(
  value: string,
  { createIfMissing = true, focus = true }: { createIfMissing?: boolean; focus?: boolean } = {},
) {
  const url = safeUrl.parse(value);
  if (!url) throw new Error('This routine has no link.');
  const target = normalizedPageUrl(url);
  const tabs = await browser.tabs.query({});
  const matches = tabs
    .filter((tab) => {
      const address = tab.pendingUrl || tab.url;
      if (!address || tab.incognito) return false;
      try {
        return normalizedPageUrl(address) === target;
      } catch {
        return false;
      }
    })
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) || (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0),
    );
  for (const tab of matches) {
    if (tab.id === undefined) continue;
    if (!focus) return { reused: true, tabId: tab.id };
    try {
      await browser.tabs.update(tab.id, { active: true });
      if (tab.windowId !== undefined) await browser.windows.update(tab.windowId, { focused: true });
      return { reused: true, tabId: tab.id };
    } catch {
      /* A matching tab may have closed between query and activation. */
    }
  }
  if (!createIfMissing) return { reused: false };
  const tab = await browser.tabs.create({ url, active: focus });
  if (focus && tab.windowId !== undefined)
    await browser.windows.update(tab.windowId, { focused: true });
  return { reused: false, tabId: tab.id };
}

export async function currentWebTab(): Promise<{ title: string; url: string } | undefined> {
  const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  let tab = tabs[0];
  if (tab?.url?.startsWith(browser.runtime.getURL('/'))) {
    // In the full dashboard (or a standalone popup), use the last viewed webpage.
    tab = (await browser.tabs.query({ lastFocusedWindow: true }))
      .filter((t) => !t.incognito && !!t.url && safeUrl.safeParse(t.url).success)
      .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];
  }
  const url = tab?.pendingUrl || tab?.url;
  if (!url || tab?.incognito || !safeUrl.safeParse(url).success) return;
  return { title: (tab?.title || new URL(url).hostname).slice(0, 200), url };
}
