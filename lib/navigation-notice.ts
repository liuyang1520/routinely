export type NavigationReason = {
  kind: 'routine' | 'delayed-view' | 'link';
  title: string;
  scheduledAt?: number;
};

export type NavigationNotice = NavigationReason & {
  id: string;
  reused: boolean;
  expiresAt: number;
};

export const NAVIGATION_TOAST_DURATION = 8000;
