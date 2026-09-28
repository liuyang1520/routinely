import { emptyState, stateSchema, STORAGE_KEY, type Action, type State } from './model';
import { reconcile } from './schedule';
import { reduceState } from './reducer';

export const isExtension =
  typeof location !== 'undefined' &&
  ['chrome-extension:', 'moz-extension:'].includes(location.protocol);
// Capture the environment once. Reloading the extension removes runtime.id
// from old content scripts; they must never fall back to a website's storage.
const startedInExtension =
  isExtension ||
  !!(globalThis as typeof globalThis & { chrome?: { runtime?: { id?: string } } }).chrome?.runtime
    ?.id;
const extensionContext = () => startedInExtension;
export async function readState(): Promise<State> {
  if (extensionContext()) {
    const { browser } = await import('wxt/browser');
    const response = await browser.runtime.sendMessage({ type: 'get-state' });
    if (response.error) throw new Error(response.error);
    return response.state;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  const state = reconcile(stored ? stateSchema.parse(JSON.parse(stored)) : emptyState());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}
export async function getStorageUsage(): Promise<{ bytes: number; quotaBytes?: number }> {
  if (extensionContext()) {
    const { browser } = await import('wxt/browser');
    const bytes = await browser.storage.local.getBytesInUse(null);
    const quotaBytes = Number(browser.storage.local.QUOTA_BYTES);
    return { bytes, quotaBytes: Number.isFinite(quotaBytes) ? quotaBytes : undefined };
  }
  let bytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) bytes += new Blob([key, localStorage.getItem(key) ?? '']).size;
  }
  return { bytes };
}
let queue = Promise.resolve();
export async function dispatch(action: Action): Promise<State> {
  if (extensionContext()) {
    const { browser } = await import('wxt/browser');
    const result = await browser.runtime.sendMessage({ type: 'mutate', action });
    if (result.error) throw new Error(result.error);
    return result.state;
  }
  const result = queue.then(async () => {
    const state = reduceState(await readState(), action);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event('routinely-change'));
    return state;
  });
  queue = result.then(
    () => {},
    () => {},
  );
  return result;
}
export function subscribe(callback: () => void): () => void {
  let disposed = false;
  let cleanup = () => {};
  if (extensionContext()) {
    void import('wxt/browser').then(({ browser }) => {
      if (disposed) return;
      const listener = (changes: Record<string, unknown>) => {
        if (STORAGE_KEY in changes) callback();
      };
      browser.storage.onChanged.addListener(listener);
      cleanup = () => browser.storage.onChanged.removeListener(listener);
    });
  } else {
    window.addEventListener('routinely-change', callback);
    window.addEventListener('storage', callback);
    cleanup = () => {
      window.removeEventListener('routinely-change', callback);
      window.removeEventListener('storage', callback);
    };
  }
  return () => {
    disposed = true;
    cleanup();
  };
}
export async function openDashboard(): Promise<void> {
  if (extensionContext()) {
    const { browser } = await import('wxt/browser');
    await browser.runtime.sendMessage({ type: 'open-dashboard' });
  } else window.open('/', '_blank', 'noopener');
}

export async function openLink(url: string): Promise<void> {
  if (extensionContext()) {
    const { browser } = await import('wxt/browser');
    const result = await browser.runtime.sendMessage({ type: 'open-link', url });
    if (result.error) throw new Error(result.error);
  } else window.open(url, '_blank', 'noopener');
}

export async function getCurrentTab(): Promise<{ title: string; url: string } | undefined> {
  if (!extensionContext()) return;
  const { browser } = await import('wxt/browser');
  const response = await browser.runtime.sendMessage({ type: 'current-tab' });
  if (response.error) throw new Error(response.error);
  return response.tab;
}
