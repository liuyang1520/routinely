import { useState } from 'react';
import { ArrowUpRight, Bell, CheckCheck, X } from 'lucide-react';
import { Brand } from './Brand';
import { Button } from './ui/button';
import { OccurrenceCard } from './OccurrenceCard';
import { dueItems } from '../lib/schedule';
import { emptyState, type Action, type State } from '../lib/model';
import { reduceState } from '../lib/reducer';
import { openDashboard } from '../lib/client';

export function ReminderPanel({
  state,
  act,
  onClose,
  preview = false,
}: {
  state: State;
  act: (action: Action) => Promise<boolean>;
  onClose: (id?: string) => void;
  preview?: boolean;
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
      aria-label={preview ? 'Reminder preview' : 'Routinely reminder'}
    >
      <header>
        <Brand small />
        <div>
          {preview && <span className="preview-tag">Preview</span>}
          <Button
            variant="ghost"
            size="icon"
            aria-label={preview ? 'Close preview' : 'Snooze this reminder for 10 minutes'}
            onClick={() => onClose(item?.id)}
          >
            <X />
          </Button>
        </div>
      </header>
      <div className="reminder-intro">
        <span>
          <Bell size={13} />
          {preview ? 'A LITTLE PREVIEW' : 'A LITTLE NUDGE'}
        </span>
        <h2>{item ? 'A moment for your routine.' : 'A little thing, well done.'}</h2>
        <p>
          {item
            ? 'No rush. Just a little space for what matters.'
            : 'You’re all caught up. See you next time.'}
        </p>
      </div>
      {item ? (
        <OccurrenceCard key={item.id} item={item} act={perform} compact />
      ) : (
        <div className="panel-done">
          <CheckCheck size={32} />
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
        ) : (
          <span>
            {preview ? 'Try the checklist, notes, or snooze.' : 'One small thing at a time.'}
          </span>
        )}
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
  onClose,
}: {
  position: State['settings']['position'];
  onClose: () => void;
}) {
  const [state, setState] = useState<State>(() => {
    const now = Date.now();
    return {
      ...emptyState(now),
      settings: { reminders: true, position, focusExistingTabs: true },
      routines: [
        {
          id: 'preview',
          title: 'Catch up on Hacker News',
          url: 'https://news.ycombinator.com',
          category: 'Learning',
          notes: '',
          tasks: [],
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
          category: 'Learning',
          url: 'https://news.ycombinator.com',
          scheduledAt: now,
          status: 'pending',
          notes: 'Find one idea worth coming back to.',
          tasks: [
            { id: 'read', title: 'Read something interesting', done: false },
            { id: 'save', title: 'Save a favorite for later', done: false },
          ],
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
