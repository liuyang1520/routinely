import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ExternalLink,
  SkipForward,
  Clock3,
  Undo2,
  ListChecks,
  StickyNote,
  BookOpen,
  Heart,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import type { Action, Occurrence } from '../lib/model';
import { timeLabel } from '../lib/schedule';
import { Button } from './ui/button';
import { PageLink } from './PageLink';

export const categoryIcons = {
  Personal: Sparkles,
  Learning: BookOpen,
  Wellbeing: Heart,
  Work: Briefcase,
};
export function CategoryIcon({ category }: { category: Occurrence['category'] }) {
  const Icon = categoryIcons[category];
  return (
    <span className={`category-icon category-${category.toLowerCase()}`}>
      <Icon size={20} />
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
  const [pendingTasks, setPendingTasks] = useState<Record<string, boolean>>({});
  const completed = item.status === 'completed';
  const due = item.status === 'pending' && item.scheduledAt <= Date.now();
  const snoozed = !!item.snoozedUntil && item.snoozedUntil > Date.now();
  const perform = async (action: Action) => {
    setBusy(true);
    await act(action);
    setBusy(false);
  };
  const toggleTask = async (taskId: string, done: boolean) => {
    setPendingTasks((current) => ({ ...current, [taskId]: done }));
    await perform({ type: 'task', id: item.id, taskId, done });
    setPendingTasks((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
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
        {!compact && <CategoryIcon category={item.category} />}
        <div className="occurrence-copy">
          <h3>{item.title}</h3>
          <div className="routine-meta">
            <span>{item.category}</span>
            <span className="meta-dot">·</span>
            <span>{timeLabel(item.scheduledAt)}</span>
            {item.tasks.length > 0 && (
              <>
                <span className="meta-dot">·</span>
                <span>
                  <ListChecks size={12} />
                  {item.tasks.filter((t) => t.done).length}/{item.tasks.length}
                </span>
              </>
            )}
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
          {item.tasks.length > 0 && (
            <div className="checklist">
              {item.tasks.map((task) => (
                <label
                  key={task.id}
                  className={(pendingTasks[task.id] ?? task.done) ? 'task-done' : ''}
                >
                  <input
                    type="checkbox"
                    checked={pendingTasks[task.id] ?? task.done}
                    disabled={readOnly || busy}
                    onChange={(e) => void toggleTask(task.id, e.target.checked)}
                  />
                  <span>{task.title}</span>
                </label>
              ))}
            </div>
          )}
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
