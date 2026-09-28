import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyThemeToDocument,
  getStoredTheme,
  initTheme,
  persistTheme,
  subscribeTheme,
  THEME_KEY,
} from '../lib/theme';

describe('theme utilities', () => {
  let localStorageStore: Record<string, string>;
  let mockHtmlElement: {
    setAttribute: ReturnType<typeof vi.fn>;
    classList: {
      toggle: ReturnType<typeof vi.fn>;
    };
    style: {
      colorScheme: string;
    };
  };

  beforeEach(() => {
    localStorageStore = {};
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageStore[key];
      }),
      clear: vi.fn(() => {
        localStorageStore = {};
      }),
    };

    mockHtmlElement = {
      setAttribute: vi.fn(),
      classList: {
        toggle: vi.fn(),
      },
      style: {
        colorScheme: '',
      },
    };

    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('document', {
      documentElement: mockHtmlElement,
    });
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      matchMedia: vi.fn(() => ({ matches: true })),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('defaults to the device theme when nothing is stored', () => {
    expect(getStoredTheme()).toBe('system');
    applyThemeToDocument('system');
    expect(mockHtmlElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
    applyThemeToDocument('system');
    expect(mockHtmlElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
  });

  it('reads stored light theme from localStorage', () => {
    localStorageStore[THEME_KEY] = 'light';
    expect(getStoredTheme()).toBe('light');
  });

  it('persists system mode', async () => {
    await persistTheme('system');
    expect(localStorageStore[THEME_KEY]).toBe('system');
  });

  it('applies theme attributes and classes to documentElement', () => {
    applyThemeToDocument('light');
    expect(mockHtmlElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    expect(mockHtmlElement.classList.toggle).toHaveBeenCalledWith('dark', false);
    expect(mockHtmlElement.classList.toggle).toHaveBeenCalledWith('light', true);
    expect(mockHtmlElement.style.colorScheme).toBe('light');

    applyThemeToDocument('dark');
    expect(mockHtmlElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    expect(mockHtmlElement.classList.toggle).toHaveBeenCalledWith('dark', true);
    expect(mockHtmlElement.classList.toggle).toHaveBeenCalledWith('light', false);
    expect(mockHtmlElement.style.colorScheme).toBe('dark');
  });

  it('initializes document theme from storage', () => {
    localStorageStore[THEME_KEY] = 'light';
    const current = initTheme();
    expect(current).toBe('light');
    expect(mockHtmlElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
  });

  it('persists theme to localStorage and dispatches window event', async () => {
    await persistTheme('light');
    expect(localStorageStore[THEME_KEY]).toBe('light');
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'routinely-theme-change', detail: 'light' }),
    );
  });

  it('subscribes to window storage events', () => {
    let storageHandler: ((e: any) => void) | undefined;
    vi.mocked(window.addEventListener).mockImplementation((event: string, handler: any) => {
      if (event === 'storage') storageHandler = handler;
    });

    const callback = vi.fn();
    const unsubscribe = subscribeTheme(callback);

    expect(storageHandler).toBeDefined();
    storageHandler?.({ key: THEME_KEY, newValue: 'light' });
    expect(callback).toHaveBeenCalledWith('light');

    unsubscribe();
    expect(window.removeEventListener).toHaveBeenCalledWith('storage', storageHandler);
  });

  it('subscribes to in-window custom events', () => {
    let customHandler: ((e: any) => void) | undefined;
    vi.mocked(window.addEventListener).mockImplementation((event: string, handler: any) => {
      if (event === 'routinely-theme-change') customHandler = handler;
    });

    const callback = vi.fn();
    const unsubscribe = subscribeTheme(callback);

    expect(customHandler).toBeDefined();
    customHandler?.({ detail: 'dark' });
    expect(callback).toHaveBeenCalledWith('dark');

    unsubscribe();
    expect(window.removeEventListener).toHaveBeenCalledWith(
      'routinely-theme-change',
      customHandler,
    );
  });
});
