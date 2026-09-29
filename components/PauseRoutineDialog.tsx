import { useState } from 'react';
import type { Action, Routine } from '../lib/model';
import { addDays, dayKey, startOfDay } from '../lib/schedule';
import { Modal } from './ui/dialog';
import { Button } from './ui/button';

export function PauseRoutineDialog({
  routine,
  act,
  onClose,
}: {
  routine: Routine;
  act: (action: Action) => Promise<boolean>;
  onClose: () => void;
}) {
  const [date, setDate] = useState(() => dayKey(addDays(Date.now(), 1)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tomorrow = startOfDay(addDays(Date.now(), 1)).getTime();
  const nextWeek = startOfDay(addDays(Date.now(), 7)).getTime();

  const pause = async (until?: number) => {
    setBusy(true);
    setError('');
    const ok = await act({ type: 'pause-routine', id: routine.id, until });
    setBusy(false);
    if (ok) onClose();
    else setError('Could not pause this routine. Please try again.');
  };

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Pause ${routine.title}?`}
      description="Take a break from this routine. Completed check-ins stay in your history."
    >
      <div className="pause-choices">
        <Button variant="outline" disabled={busy} onClick={() => void pause(tomorrow)}>
          Until tomorrow
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void pause(nextWeek)}>
          For one week
        </Button>
        <div className="pause-custom">
          <label htmlFor="pause-return-date">Or choose a return date</label>
          <span>
            <input
              id="pause-return-date"
              aria-label="Return date"
              type="date"
              min={dayKey(tomorrow)}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <Button
              disabled={busy || !date || date < dayKey(tomorrow)}
              onClick={() => void pause(new Date(`${date}T00:00:00`).getTime())}
            >
              Pause until date
            </Button>
          </span>
        </div>
        <Button variant="ghost" disabled={busy} onClick={() => void pause()}>
          Until I resume
        </Button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
