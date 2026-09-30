import { useState } from 'react';
import { ArrowUpRight, CheckCheck, X } from 'lucide-react';
import { Brand } from './Brand';
import { Button } from './ui/button';
import { OccurrenceCard } from './OccurrenceCard';
import { dueItems } from '../lib/schedule';
import { emptyState, type Action, type State } from '../lib/model';
import { reduceState } from '../lib/reducer';
import { openDashboard } from '../lib/client';
import { resolvedTheme, type Theme } from '../lib/theme';

export function ReminderPanel({
  state,
  act,
  onClose,
  preview = false,
  colorMode,
}: {
  state: State;
  act: (action: Action) => Promise<boolean>;
  onClose: (id?: string) => void;
  preview?: boolean;
  colorMode: 'light' | 'dark';
}) {
  const items = dueItems(state);
  const [index, setIndex] = useState(0);
  const item = items[Math.min(index, Math.max(0, items.length - 1))];
  const [error, setError] = useState('');
  const perform = async (action: Action) => {
    const ok = await act(action);
    setError(ok ? '' : 'Could not save. Please try again.');
    return ok;
  };
  return (
    <section
      className={`reminder-panel position-${state.settings.position}`}
      data-theme={colorMode}
      aria-label={preview ? 'Reminder preview' : 'Routinely reminder'}
    >
      <header>
        <Brand small />
        <div>
          {preview && <span className="preview-tag">Preview</span>}
          <Button
            variant="ghost"
            size="icon"
            aria-label={preview ? 'Close preview' : 'Dismiss this reminder'}
            onClick={() => onClose(item?.id)}
          >
            <X />
          </Button>
        </div>
      </header>
      {item ? (
        <OccurrenceCard
          key={item.id}
          item={item}
          act={perform}
          compact
          showNotes={state.settings.reminderNotes}
          notePlaceholder={preview ? 'Find one idea worth coming back to.' : undefined}
        />
      ) : (
        <div className="panel-done">
          <CheckCheck size={24} aria-hidden="true" />
          <p>All caught up.</p>
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <footer>
        {items.length > 1 ? (
          <div className="panel-pagination">
            {items.map((o, i) => (
              <button
                key={o.id}
                aria-label={`Show reminder ${i + 1}`}
                aria-pressed={i === index}
                className={i === index ? 'active' : ''}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        ) : null}
        <button
          onClick={() => {
            if (preview) onClose();
            else
              void openDashboard().catch(() =>
                setError('Refresh this page to reconnect Routinely.'),
              );
          }}
        >
          {preview ? 'Got it' : 'Your routines'}
          <ArrowUpRight size={13} />
        </button>
      </footer>
    </section>
  );
}
export function ReminderPreview({
  position,
  reminderNotes,
  onClose,
  theme,
}: {
  position: State['settings']['position'];
  reminderNotes: boolean;
  onClose: () => void;
  theme: Theme;
}) {
  const [state, setState] = useState<State>(() => {
    const now = Date.now();
    return {
      ...emptyState(now),
      settings: { ...emptyState(now).settings, position, reminderNotes },
      routines: [
        {
          id: 'preview',
          title: 'Catch up on Hacker News',
          url: 'https://news.ycombinator.com',
          label: 'Learning',
          notes: '',
          createdAt: now,
          startAt: now,
          enabled: true,
          schedule: { frequency: 'daily', time: '21:00', days: [1], monthDay: 1, interval: 1 },
        },
      ],
      occurrences: [
        {
          id: 'preview-check-in',
          routineId: 'preview',
          title: 'Catch up on Hacker News',
          label: 'Learning',
          url: 'https://news.ycombinator.com',
          scheduledAt: now,
          status: 'pending',
          notes: '',
        },
      ],
    };
  });
  return (
    <div className="reminder-preview-backdrop" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <ReminderPanel
          state={state}
          preview
          colorMode={resolvedTheme(theme)}
          onClose={onClose}
          act={async (action) => {
            setState((s) => reduceState(s, action));
            return true;
          }}
        />
      </div>
    </div>
  );
}
