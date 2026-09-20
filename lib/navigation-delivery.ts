import { browser } from 'wxt/browser';
import type { NavigationNotice, NavigationReason } from './navigation-notice';

const prefix = 'routinely-navigation-';

// Session storage survives worker suspension while a destination is loading,
// but these short-lived explanations are not part of the user's backup/history.
export async function queueNavigationNotice(
  result: { tabId?: number; reused: boolean },
  reason: NavigationReason,
) {
  if (result.tabId === undefined) return;
  const notice: NavigationNotice = {
    ...reason,
    id: crypto.randomUUID(),
    reused: result.reused,
    expiresAt: Date.now() + 120000,
  };
  await browser.storage.session.set({ [`${prefix}${result.tabId}`]: notice });
  await deliverNavigationNotice(result.tabId);
}

export async function deliverNavigationNotice(tabId: number) {
  const key = `${prefix}${tabId}`;
  const notice = (await browser.storage.session.get(key))[key] as NavigationNotice | undefined;
  if (!notice) return;
  if (notice.expiresAt <= Date.now()) {
    await browser.storage.session.remove(key);
    return;
  }
  try {
    const response = await browser.tabs.sendMessage(
      tabId,
      { type: 'navigation-notice', notice },
      { frameId: 0 },
    );
    if (response?.shown) await browser.storage.session.remove(key);
  } catch {
    // A new page may still be loading. Its panel-ready handshake retries delivery.
  }
}

export async function forgetNavigationNotice(tabId: number) {
  await browser.storage.session.remove(`${prefix}${tabId}`);
}
