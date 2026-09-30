import { useRef, useState } from 'react';
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
  showNotes = true,
  notePlaceholder = 'Add a note…',
}: {
  item: Occurrence;
  act: (action: Action) => Promise<boolean>;
  compact?: boolean;
  readOnly?: boolean;
  minimal?: boolean;
  showNotes?: boolean;
  notePlaceholder?: string;
}) {
  const [expanded, setExpanded] = useState(compact);
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [noteHeight, setNoteHeight] = useState(96);
  const [resizing, setResizing] = useState(false);
  const resizeStart = useRef<{ y: number; height: number } | null>(null);
  const dragged = useRef(false);
  const noteValue = note ?? item.notes;
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
          {showNotes && (
            <div className="occurrence-notes-section">
              <label className="occurrence-note">
                {!noteValue && (
                  <>
                    <StickyNote size={15} aria-hidden="true" />
                    <span className="occurrence-note-placeholder" aria-hidden="true">
                      {notePlaceholder}
                    </span>
                  </>
                )}
                <textarea
                  aria-label={`Notes for ${item.title}`}
                  maxLength={10000}
                  rows={2}
                  readOnly={readOnly}
                  placeholder={notePlaceholder}
                  value={noteValue}
                  style={compact ? { height: noteHeight } : undefined}
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
              {compact && !readOnly && (
                <button
                  type="button"
                  className={`notes-resize-handle ${resizing ? 'is-resizing' : ''}`}
                  aria-label={`Resize notes for ${item.title}`}
                  title="Drag up or down to resize notes, or click to add space"
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    resizeStart.current = { y: e.clientY, height: noteHeight };
                    dragged.current = false;
                    setResizing(true);
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const start = resizeStart.current;
                    if (!start) return;
                    const distance = e.clientY - start.y;
                    if (Math.abs(distance) > 3) dragged.current = true;
                    setNoteHeight(Math.max(96, Math.min(640, start.height + distance)));
                  }}
                  onPointerUp={(e) => {
                    resizeStart.current = null;
                    setResizing(false);
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    }
                  }}
                  onLostPointerCapture={() => {
                    resizeStart.current = null;
                    setResizing(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      const distance = e.key === 'ArrowDown' ? 24 : -24;
                      setNoteHeight((height) => Math.max(96, Math.min(640, height + distance)));
                    }
                  }}
                  onClick={(e) => {
                    if (e.detail === 0 || !dragged.current) {
                      setNoteHeight((height) => Math.min(640, height + 24));
                    }
                    dragged.current = false;
                  }}
                >
                  <span aria-hidden="true">···</span>
                </button>
              )}
            </div>
          )}
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
                    className="occurrence-mark-done"
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
