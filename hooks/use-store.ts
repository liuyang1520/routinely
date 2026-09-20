import { useCallback, useEffect, useState } from 'react';
import { dispatch, readState, subscribe } from '../lib/client';
import type { Action, State } from '../lib/model';

export function useStore() {
  const [state, setState] = useState<State>();
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      void readState()
        .then((s) => {
          if (alive) setState(s);
        })
        .catch((e) => {
          if (alive) setError(String(e.message));
        });
    refresh();
    const unsubscribe = subscribe(refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      alive = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, []);
  const act = useCallback(async (action: Action) => {
    try {
      const updated = await dispatch(action);
      setState(updated);
      setError('');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
      return false;
    }
  }, []);
  return { state, act, error, clearError: () => setError('') };
}
