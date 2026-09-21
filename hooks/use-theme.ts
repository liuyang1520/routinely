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
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, [setTheme]);

  return { theme, setTheme, toggleTheme };
}
