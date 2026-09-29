import { useState } from 'react';
import { ChevronDown, StickyNote } from 'lucide-react';
import type { Action } from '../lib/model';

export function Scratchpad({
  value,
  act,
}: {
  value: string;
  act: (action: Action) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(Boolean(value));
  const [draft, setDraft] = useState<string>();
  return (
    <section className="scratchpad surface">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          <StickyNote size={16} /> A note to keep handy
        </span>
        <ChevronDown size={16} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <textarea
          aria-label="A note to keep handy"
          rows={2}
          maxLength={20000}
          placeholder="Something you'd like to remember…"
          value={draft ?? value}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== undefined && draft !== value) {
              const next = draft;
              void act({ type: 'scratchpad', value: next }).then((ok) => {
                if (ok) setDraft((current) => (current === next ? undefined : current));
              });
            }
          }}
        />
      )}
    </section>
  );
}
