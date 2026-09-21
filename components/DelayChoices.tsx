import { useState } from 'react';
import { CalendarClock, Check, Clock3 } from 'lucide-react';
import { Button } from './ui/button';

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatFriendlyPreview(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const isTomorrow =
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toDateString() ===
    d.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isTomorrow) {
    return `Tomorrow at ${timeStr}`;
  }
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at ${timeStr}`;
}

export function DelayChoices({
  onSchedule,
  disabled = false,
}: {
  onSchedule: (dueAt: number) => Promise<boolean>;
  disabled?: boolean;
}) {
  const [custom, setCustom] = useState(false);
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleCustom = () => {
    if (!custom && !date) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      setDate(toDatetimeLocal(d));
    }
    setCustom(!custom);
  };

  const schedule = async (dueAt: number) => {
    if (!Number.isFinite(dueAt) || dueAt <= Date.now()) {
      setError('Choose a time in the future.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (!(await onSchedule(dueAt)))
        setError('Could not schedule this page. Check the link and try again.');
    } catch {
      setError('Could not schedule this page. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="delay-choices">
      <div className="delay-presets">
        {[
          { hours: 1, label: '1 hour' },
          { hours: 3, label: '3 hours' },
          { hours: 24, label: '1 day' },
          { hours: 168, label: '1 week' },
        ].map(({ hours, label }) => (
          <Button
            key={hours}
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || busy}
            onClick={() => void schedule(Date.now() + hours * 3600000)}
          >
            {label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={custom ? 'default' : 'ghost'}
          disabled={disabled || busy}
          aria-expanded={custom}
          onClick={toggleCustom}
        >
          <CalendarClock />
          Custom
        </Button>
      </div>
      {custom && (
        <div className="custom-delay-picker">
          <div className="custom-delay-header">
            <span className="label">
              <CalendarClock size={14} />
              Custom schedule
            </span>
            <span className="hint">Pick a future time</span>
          </div>

          <div className="custom-delay-shortcuts" aria-label="Quick time shortcuts">
            {[
              {
                label: 'Tomorrow 9am',
                getDate: () => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  d.setHours(9, 0, 0, 0);
                  return d;
                },
              },
              {
                label: 'Tomorrow 6pm',
                getDate: () => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  d.setHours(18, 0, 0, 0);
                  return d;
                },
              },
              {
                label: 'In 2 days',
                getDate: () => {
                  const d = new Date();
                  d.setDate(d.getDate() + 2);
                  d.setHours(9, 0, 0, 0);
                  return d;
                },
              },
              {
                label: 'Next week',
                getDate: () => {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  d.setHours(9, 0, 0, 0);
                  return d;
                },
              },
            ].map((shortcut) => {
              const targetStr = toDatetimeLocal(shortcut.getDate());
              return (
                <button
                  key={shortcut.label}
                  type="button"
                  className={date === targetStr ? 'active' : ''}
                  onClick={() => setDate(targetStr)}
                >
                  {shortcut.label}
                </button>
              );
            })}
          </div>

          <div className="custom-delay-input-row">
            <div className="custom-datetime-wrapper">
              <input
                aria-label="Come back at"
                type="datetime-local"
                min={toDatetimeLocal(new Date())}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="custom-datetime-input"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="custom-delay-submit"
              disabled={disabled || busy || !date}
              onClick={() => void schedule(new Date(date).getTime())}
            >
              <Check size={15} />
              Set time
            </Button>
          </div>

          {date && !isNaN(new Date(date).getTime()) && new Date(date).getTime() > Date.now() && (
            <div className="custom-delay-preview">
              <Clock3 size={12} />
              <span>Coming back {formatFriendlyPreview(new Date(date).getTime())}</span>
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
