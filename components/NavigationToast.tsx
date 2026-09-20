import { useEffect, useState } from 'react';
import { ArrowUpRight, Clock3, X } from 'lucide-react';
import { NAVIGATION_TOAST_DURATION, type NavigationNotice } from '../lib/navigation-notice';

export function NavigationToast({
  notice,
  onDismiss,
}: {
  notice: NavigationNotice;
  onDismiss: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (hovered || focused) return;
    const timer = window.setTimeout(onDismiss, NAVIGATION_TOAST_DURATION);
    return () => window.clearTimeout(timer);
  }, [notice.id, hovered, focused, onDismiss]);

  const heading =
    notice.kind === 'delayed-view'
      ? 'Your saved page is ready'
      : notice.kind === 'routine'
        ? 'Time for your routine'
        : 'A page from Routinely';
  const action = notice.reused ? 'Switched to this tab' : 'Opened this tab';
  return (
    <aside
      className="navigation-toast"
      aria-label="Why Routinely opened this page"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <span className="navigation-toast-icon" aria-hidden="true">
        {notice.kind === 'link' ? <ArrowUpRight size={20} /> : <Clock3 size={20} />}
      </span>
      <div role="status" aria-live="polite" aria-atomic="true">
        <span className="navigation-toast-brand">ROUTINELY</span>
        <h2>{heading}</h2>
        <p>
          {action}
          {notice.kind === 'link' ? ' from Routinely.' : ` for “${notice.title}”.`}
        </p>
        {notice.scheduledAt !== undefined && (
          <p className="navigation-toast-time">
            {notice.kind === 'delayed-view' ? 'You saved it for ' : 'Scheduled for '}
            {new Date(notice.scheduledAt).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
            .
          </p>
        )}
      </div>
      <button aria-label="Dismiss navigation notice" onClick={onDismiss}>
        <X size={17} />
      </button>
    </aside>
  );
}
