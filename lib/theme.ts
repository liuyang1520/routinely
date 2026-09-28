export type Theme = 'dark' | 'light' | 'system';

export function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light' || value === 'system';
}

export function resolvedTheme(theme: Theme): 'dark' | 'light' {
  if (theme !== 'system') return theme;
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export const THEME_KEY = 'routinely-theme';
export const THEME_SYNC_CHANNEL = 'routinely-theme-sync';

export const isExtension =
  typeof location !== 'undefined' &&
  ['chrome-extension:', 'moz-extension:'].includes(location.protocol);

const startedInExtension =
  isExtension ||
  !!(globalThis as typeof globalThis & { chrome?: { runtime?: { id?: string } } }).chrome?.runtime
    ?.id;

export const extensionContext = () => startedInExtension;

export function getStoredTheme(): Theme {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (isTheme(stored)) {
        return stored;
      }
    } catch {
      // Storage access may fail in sandboxed contexts
    }
  }
  return 'system';
}

export function applyThemeToDocument(theme: Theme) {
  if (typeof document === 'undefined') return;
  const resolved = resolvedTheme(theme);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.classList.toggle('light', resolved === 'light');
  document.documentElement.style.colorScheme = resolved;
}

export function initTheme(): Theme {
  const theme = getStoredTheme();
  applyThemeToDocument(theme);
  return theme;
}

let sharedBroadcastChannel: BroadcastChannel | undefined;
function getBroadcastChannel(): BroadcastChannel | undefined {
  if (typeof BroadcastChannel === 'undefined') return undefined;
  if (!sharedBroadcastChannel) {
    try {
      sharedBroadcastChannel = new BroadcastChannel(THEME_SYNC_CHANNEL);
    } catch {
      // ignore
    }
  }
  return sharedBroadcastChannel;
}

export async function readExtensionTheme(): Promise<Theme | undefined> {
  if (extensionContext()) {
    try {
      const { browser } = await import('wxt/browser');
      if (browser?.storage?.local) {
        const data = await browser.storage.local.get(THEME_KEY);
        const val = data?.[THEME_KEY];
        if (isTheme(val)) {
          return val;
        }
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}

export async function persistTheme(theme: Theme): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }

    try {
      window.dispatchEvent(new CustomEvent('routinely-theme-change', { detail: theme }));
    } catch {
      // ignore
    }

    try {
      getBroadcastChannel()?.postMessage(theme);
    } catch {
      // ignore
    }
  }

  if (extensionContext()) {
    try {
      const { browser } = await import('wxt/browser');
      if (browser?.storage?.local) {
        await browser.storage.local.set({ [THEME_KEY]: theme });
      }
    } catch {
      // ignore
    }
  }
}

export function subscribeTheme(callback: (theme: Theme) => void): () => void {
  let disposed = false;
  let cleanupStorage = () => {};

  // 1. Extension storage listener
  if (extensionContext()) {
    void import('wxt/browser')
      .then(({ browser }) => {
        if (disposed) return;
        if (browser?.storage?.onChanged) {
          const listener = (changes: Record<string, { newValue?: unknown }>) => {
            if (THEME_KEY in changes) {
              const val = changes[THEME_KEY]?.newValue;
              if (isTheme(val)) {
                callback(val);
              }
            }
          };
          browser.storage.onChanged.addListener(listener);
          cleanupStorage = () => browser.storage.onChanged.removeListener(listener);
        }
      })
      .catch(() => {});
  }

  // 2. BroadcastChannel
  const channel = getBroadcastChannel();
  const onMessage = (event: MessageEvent) => {
    if (disposed) return;
    if (isTheme(event.data)) {
      callback(event.data);
    }
  };
  channel?.addEventListener('message', onMessage);

  // 3. Window storage event (for other windows on the same origin using localStorage)
  const onStorage = (event: StorageEvent) => {
    if (disposed) return;
    if (event.key === THEME_KEY && isTheme(event.newValue)) {
      callback(event.newValue);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  // 4. In-window custom event
  const onCustom = (event: Event) => {
    if (disposed) return;
    const detail = (event as CustomEvent<Theme>).detail;
    if (isTheme(detail)) {
      callback(detail);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('routinely-theme-change', onCustom);
  }

  return () => {
    disposed = true;
    cleanupStorage();
    channel?.removeEventListener('message', onMessage);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('routinely-theme-change', onCustom);
    }
  };
}
