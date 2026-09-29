import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ExternalLink,
  SkipForward,
  Clock3,
  Undo2,
  StickyNote,
  Sparkles,
} from 'lucide-react';
import type { Action, Occurrence } from '../lib/model';
import { laterTodayAt, timeLabel } from '../lib/schedule';
import { Button } from './ui/button';
import { PageLink } from './PageLink';

export function RoutineIcon() {
  return (
    <span className="routine-icon">
      <Sparkles size={20} />
    </span>
  );
}
export function OccurrenceCard({
  item,
  act,
  compact = false,
  readOnly = false,
  minimal = false,
}: {
  item: Occurrence;
  act: (action: Action) => Promise<boolean>;
  compact?: boolean;
  readOnly?: boolean;
  minimal?: boolean;
}) {
  const [expanded, setExpanded] = useState(compact);
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState(false);
  const completed = item.status === 'completed';
  const due = item.status === 'pending' && item.scheduledAt <= Date.now();
  const snoozed = !!item.snoozedUntil && item.snoozedUntil > Date.now();
  const laterToday = due ? laterTodayAt() : undefined;
  const perform = async (action: Action) => {
    setBusy(true);
    await act(action);
    setBusy(false);
  };
  return (
    <article
      className={`occurrence-card ${completed ? 'is-complete' : ''} ${compact ? 'compact-card' : ''}`}
    >
      <div className="occurrence-main">
        <button
          className={`completion-check ${completed ? 'checked' : ''}`}
          disabled={busy || readOnly}
          aria-label={`${completed ? 'Undo completion of' : 'Complete'} ${item.title}`}
          onClick={() => void perform({ type: completed ? 'undo' : 'complete', id: item.id })}
        >
          {completed && <Check size={15} />}
        </button>
        {!compact && <RoutineIcon />}
        <div className="occurrence-copy">
          <h3>{item.title}</h3>
          <div className="routine-meta">
            {item.label && (
              <>
                <span>{item.label}</span>
                <span className="meta-dot">·</span>
              </>
            )}
            <span>{timeLabel(item.scheduledAt)}</span>
          </div>
        </div>
        {!compact && (
          <span
            className={`status-tag ${completed ? 'status-completed' : due && !snoozed ? 'status-due' : ''}`}
          >
            {completed
              ? 'Completed'
              : item.status === 'skipped'
                ? 'Skipped'
                : item.status === 'missed'
                  ? 'Missed'
                  : snoozed
                    ? `Snoozed · ${timeLabel(item.snoozedUntil!)}`
                    : due
                      ? 'Ready when you are'
                      : 'Upcoming'}
          </span>
        )}
        {item.url && (
          <Button asChild size="icon" variant="ghost">
            <PageLink
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${item.title}`}
            >
              <ExternalLink />
            </PageLink>
          </Button>
        )}
        {!minimal && (
          <Button
            size="icon"
            variant="ghost"
            aria-label={`${expanded ? 'Hide' : 'Show'} details for ${item.title}`}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronDown className={expanded ? 'rotate-180' : ''} />
          </Button>
        )}
      </div>
      {!minimal && expanded && (
        <div className="occurrence-details">
          <label className="occurrence-note">
            <span>
              <StickyNote size={13} /> Notes for this check-in
            </span>
            <textarea
              aria-label={`Notes for ${item.title}`}
              maxLength={10000}
              rows={2}
              readOnly={readOnly}
              placeholder="A thought to come back to…"
              value={note ?? item.notes}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => {
                if (note !== undefined && note !== item.notes) {
                  const value = note;
                  void act({ type: 'note', id: item.id, value }).then((ok) => {
                    if (ok) setNote((current) => (current === value ? undefined : current));
                  });
                }
              }}
            />
          </label>
          {!readOnly && (
            <div className="occurrence-actions">
              {item.status === 'pending' ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void perform({ type: 'snooze', id: item.id })}
                  >
                    <Clock3 />
                    10 min
                  </Button>
                  {laterToday && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        const until = laterTodayAt();
                        if (until) void perform({ type: 'postpone', id: item.id, until });
                      }}
                    >
                      <Clock3 />
                      Later today
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void perform({ type: 'skip', id: item.id })}
                  >
                    <SkipForward />
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void perform({ type: 'complete', id: item.id })}
                  >
                    <Check />
                    Mark done
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void perform({ type: 'undo', id: item.id })}
                >
                  <Undo2 />
                  Undo {item.status === 'completed' ? 'completion' : 'status'}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
