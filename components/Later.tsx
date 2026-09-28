import { useState } from 'react';
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  Clock3,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type { Action, DelayedView, State } from '../lib/model';
import { safeUrl } from '../lib/model';
import { dayKey, timeLabel } from '../lib/schedule';
import { getCurrentTab, openLink } from '../lib/client';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';
import { DelayChoices } from './DelayChoices';

export function Later({ state, act }: { state: State; act: (action: Action) => Promise<boolean> }) {
  const [editor, setEditor] = useState<{ item?: DelayedView; title: string; url: string }>();
  const [error, setError] = useState('');
  const scheduled = state.delayedViews
    .filter((v) => v.status === 'scheduled' || v.status === 'opening')
    .sort((a, b) => a.dueAt - b.dueAt);
  const history = state.delayedViews
    .filter((v) => v.status === 'opened' || v.status === 'cancelled')
    .sort((a, b) => (b.openedAt ?? b.dueAt) - (a.openedAt ?? a.dueAt));
  const addCurrent = async () => {
    try {
      const tab = await getCurrentTab();
      setEditor({ title: tab?.title ?? '', url: tab?.url ?? '' });
    } catch {
      setEditor({ title: '', url: '' });
    }
  };
  const openNow = async (item: DelayedView) => {
    try {
      await openLink(item.url);
      await act({ type: 'mark-delayed-opened', id: item.id });
      setError('');
    } catch {
      setError('Could not open this page. Please try again.');
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A PLACE FOR NOT RIGHT NOW</p>
          <h1>Come back when it’s time.</h1>
          <p>Save a page for later. We’ll bring it back into view, right on cue.</p>
        </div>
        <Button onClick={() => void addCurrent()}>
          <Plus />
          Save a page
        </Button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <section>
        <div className="section-title later-title">
          <h2>
            Saved for later<span className="count-tag">{scheduled.length}</span>
          </h2>
          <span className="muted text-xs">Opens or switches automatically</span>
        </div>
        {scheduled.length === 0 ? (
          <div className="empty-routines">
            <Clock3 size={33} />
            <h2>A little less on your mind.</h2>
            <p>Save an article, a task, or any page you’d like to come back to.</p>
            <Button variant="outline" onClick={() => void addCurrent()}>
              <Plus />
              Save a page for later
            </Button>
          </div>
        ) : (
          <div className="later-list">
            {scheduled.map((item) => (
              <article className="later-card" key={item.id}>
                <span className="routine-icon">
                  <Clock3 size={19} />
                </span>
                <div className="later-copy">
                  <h3>{item.title}</h3>
                  <p>
                    {new URL(item.url).hostname}
                    <span>·</span>
                    {dayKey(item.dueAt) === dayKey(Date.now())
                      ? 'Today'
                      : new Date(item.dueAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                    at {timeLabel(item.dueAt)}
                  </p>
                  {item.error && <small className="form-error">{item.error}</small>}
                </div>
                <div className="later-actions">
                  <Button size="sm" variant="outline" onClick={() => void openNow(item)}>
                    <ArrowUpRight />
                    Open now
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Reschedule ${item.title}`}
                    onClick={() => setEditor({ item, title: item.title, url: item.url })}
                  >
                    <CalendarClock />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Cancel ${item.title}`}
                    onClick={() => void act({ type: 'cancel-delayed-view', id: item.id })}
                  >
                    <X />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {history.length > 0 && (
        <section className="later-history">
          <div className="section-title">
            <h2>Already brought back</h2>
          </div>
          {history.map((item) => (
            <article className="later-card" key={item.id}>
              <span className="later-result">
                {item.status === 'opened' ? <Check size={17} /> : <X size={17} />}
              </span>
              <div className="later-copy">
                <h3>{item.title}</h3>
                <p>
                  {item.status === 'opened' ? 'Opened' : 'Cancelled'}
                  <span>·</span>
                  {new Date(item.openedAt ?? item.dueAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Save ${item.title} again`}
                onClick={() => setEditor({ title: item.title, url: item.url })}
              >
                <RotateCcw />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${item.title} from history`}
                onClick={() => void act({ type: 'remove-delayed-view', id: item.id })}
              >
                <Trash2 />
              </Button>
            </article>
          ))}
        </section>
      )}
      <Modal
        open={!!editor}
        onOpenChange={(open) => {
          if (!open) {
            setEditor(undefined);
            setError('');
          }
        }}
        title={editor?.item ? 'A better time to come back.' : 'Save a little something for later.'}
        description="When it’s time, we’ll switch to the existing tab or open the page again."
      >
        {editor && (
          <div className="later-editor">
            <label>
              Page title
              <input
                aria-label="Page title"
                value={editor.title}
                readOnly={!!editor.item}
                maxLength={200}
                onChange={(e) => setEditor({ ...editor, title: e.target.value })}
              />
            </label>
            <label>
              Page link
              <input
                type="url"
                aria-label="Page link"
                value={editor.url}
                maxLength={2048}
                readOnly={!!editor.item}
                placeholder="https://…"
                onChange={(e) => setEditor({ ...editor, url: e.target.value })}
              />
            </label>
            <div>
              <h3>Bring it back in</h3>
              <DelayChoices
                onSchedule={async (dueAt) => {
                  if (
                    !editor.title.trim() ||
                    !editor.url ||
                    !safeUrl.safeParse(editor.url).success
                  ) {
                    setError('Give this page a title and a complete http:// or https:// link.');
                    return false;
                  }
                  const ok = await act(
                    editor.item
                      ? { type: 'reschedule-delayed-view', id: editor.item.id, dueAt }
                      : {
                          type: 'add-delayed-view',
                          item: {
                            id: crypto.randomUUID(),
                            title: editor.title.trim(),
                            url: editor.url.trim(),
                            createdAt: Date.now(),
                            dueAt,
                            status: 'scheduled',
                          },
                        },
                  );
                  if (ok) {
                    setEditor(undefined);
                    setError('');
                  }
                  return ok;
                }}
              />
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <p className="field-hint">
              The current tab stays open. You can close it whenever you like.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
