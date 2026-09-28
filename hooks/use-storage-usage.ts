import { useEffect, useState } from 'react';
import { getStorageUsage } from '../lib/client';
import type { State } from '../lib/model';

export function useStorageUsage(state: State | undefined) {
  const [usage, setUsage] = useState<{ bytes: number; quotaBytes?: number }>();
  useEffect(() => {
    if (!state) return;
    let active = true;
    void getStorageUsage()
      .then((value) => {
        if (active) setUsage(value);
      })
      .catch(() => {
        if (active) setUsage(undefined);
      });
    return () => {
      active = false;
    };
  }, [state]);
  return usage;
}
