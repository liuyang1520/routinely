import { useCallback, useEffect, useState } from 'react';
import {
  applyThemeToDocument,
  getStoredTheme,
  persistTheme,
  readExtensionTheme,
  subscribeTheme,
  THEME_KEY,
  type Theme,
} from '../lib/theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = getStoredTheme();
    applyThemeToDocument(initial);
    return initial;
  });

  useEffect(() => {
    applyThemeToDocument(theme);
    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyThemeToDocument('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  useEffect(() => {
    let alive = true;

    void readExtensionTheme().then((stored) => {
      if (alive && stored && stored !== theme) {
        setThemeState(stored);
        applyThemeToDocument(stored);
        try {
          localStorage.setItem(THEME_KEY, stored);
        } catch {
          // ignore
        }
      }
    });

    const unsubscribe = subscribeTheme((newTheme) => {
      if (alive) {
        setThemeState((current) => {
          if (current === newTheme) return current;
          applyThemeToDocument(newTheme);
          return newTheme;
        });
      }
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const setTheme = useCallback((newTheme: Theme | ((prev: Theme) => Theme)) => {
    setThemeState((prev) => {
      const next = typeof newTheme === 'function' ? newTheme(prev) : newTheme;
      applyThemeToDocument(next);
      void persistTheme(next);
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : prev === 'light' ? 'system' : 'dark'));
  }, [setTheme]);

  return { theme, setTheme, toggleTheme };
}
