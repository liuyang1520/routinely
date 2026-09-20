import { useState } from 'react';
import { CalendarClock, Check } from 'lucide-react';
import { Button } from './ui/button';

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
          variant="ghost"
          disabled={disabled || busy}
          aria-expanded={custom}
          onClick={() => setCustom(!custom)}
        >
          <CalendarClock />
          Custom
        </Button>
      </div>
      {custom && (
        <div className="custom-delay">
          <label>
            Come back at
            <input
              aria-label="Come back at"
              type="datetime-local"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <Button
            type="button"
            size="sm"
            disabled={disabled || busy || !date}
            onClick={() => void schedule(new Date(date).getTime())}
          >
            <Check />
            Set time
          </Button>
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
