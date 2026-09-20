import { useEffect, useState } from 'react';
import { Check, Clock3, RotateCcw } from 'lucide-react';
import { getCurrentTab } from '../lib/client';
import type { Action } from '../lib/model';
import { timeLabel } from '../lib/schedule';
import { Button } from './ui/button';
import { DelayChoices } from './DelayChoices';

export function QuickDelay({ act }: { act: (action: Action) => Promise<boolean> }) {
  const [tab, setTab] = useState<{ title: string; url: string }>();
  const [loaded, setLoaded] = useState(false);
  const [scheduled, setScheduled] = useState<{ id: string; at: number }>();
  useEffect(() => {
    let alive = true;
    void getCurrentTab()
      .then((value) => {
        if (alive) setTab(value);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <section className="quick-delay" aria-label="View this tab later">
      <h2>
        <Clock3 size={15} />
        View this tab later
      </h2>
      {!loaded ? (
        <p>Finding your current page…</p>
      ) : !tab ? (
        <p>Open this popup from a webpage to save it for later.</p>
      ) : scheduled ? (
        <div className="delay-saved" role="status">
          <Check size={17} />
          <div>
            <strong>A little space for later.</strong>
            <p>
              {new Date(scheduled.at).toLocaleDateString([], { month: 'short', day: 'numeric' })} at{' '}
              {timeLabel(scheduled.at)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Undo delayed view"
            onClick={() =>
              void act({ type: 'remove-delayed-view', id: scheduled.id }).then((ok) => {
                if (ok) setScheduled(undefined);
              })
            }
          >
            <RotateCcw />
          </Button>
        </div>
      ) : (
        <>
          <strong className="current-tab-title" title={tab.title}>
            {tab.title}
          </strong>
          <span className="current-tab-url">{new URL(tab.url).hostname}</span>
          <DelayChoices
            onSchedule={async (dueAt) => {
              const id = crypto.randomUUID();
              const ok = await act({
                type: 'add-delayed-view',
                item: {
                  id,
                  title: tab.title,
                  url: tab.url,
                  createdAt: Date.now(),
                  dueAt,
                  status: 'scheduled',
                },
              });
              if (ok) setScheduled({ id, at: dueAt });
              return ok;
            }}
          />
          <p className="delay-hint">Switches to this tab, or reopens it if you close it.</p>
        </>
      )}
    </section>
  );
}
