import { ArrowUpRight, Plus, Sun } from 'lucide-react';
import { useStore } from '../hooks/use-store';
import { forDay } from '../lib/schedule';
import { openDashboard } from '../lib/client';
import { Brand } from './Brand';
import { Button } from './ui/button';
import { OccurrenceCard } from './OccurrenceCard';
import { QuickDelay } from './QuickDelay';

export function Popup() {
  const { state, act, error } = useStore();
  const items = state ? forDay(state, new Date()) : [];
  return (
    <main className="popup">
      <header>
        <Brand small />
        <Button
          size="icon"
          variant="ghost"
          aria-label="Open dashboard"
          onClick={() => void openDashboard()}
        >
          <ArrowUpRight />
        </Button>
      </header>
      <QuickDelay act={act} />
      <div className="popup-heading">
        <span>
          <Sun size={14} />
          {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
        </span>
        <h1>A little room for today.</h1>
        <p>
          {items.filter((o) => o.status === 'completed').length} of {items.length} routines complete
        </p>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="popup-list">
        {items.map((item) => (
          <OccurrenceCard key={item.id} item={item} act={act} compact />
        ))}
        {state && items.length === 0 && (
          <div className="popup-empty">
            <Sun size={28} />
            <h2>Your day has a little space.</h2>
            <p>Add a routine to give something good a place in it.</p>
          </div>
        )}
      </div>
      <footer>
        <Button className="w-full" onClick={() => void openDashboard()}>
          <Plus />
          Open my routines
          <ArrowUpRight />
        </Button>
        <span>Saved in this browser. Just for you.</span>
      </footer>
    </main>
  );
}
