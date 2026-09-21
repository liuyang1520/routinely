import { ArrowUpRight, Moon, Plus, Sun } from 'lucide-react';
import { useStore } from '../hooks/use-store';
import { useTheme } from '../hooks/use-theme';
import { forDay } from '../lib/schedule';
import { openDashboard } from '../lib/client';
import { Brand } from './Brand';
import { Button } from './ui/button';
import { OccurrenceCard } from './OccurrenceCard';
import { QuickDelay } from './QuickDelay';

export function Popup() {
  const { state, act, error } = useStore();
  const { theme, setTheme } = useTheme();
  const items = state ? forDay(state, new Date()) : [];
  return (
    <main className="popup">
      <header>
        <Brand small />
        <div className="popup-header-actions">
          <Button
            size="icon"
            variant="ghost"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Open dashboard"
            onClick={() => void openDashboard()}
          >
            <ArrowUpRight />
          </Button>
        </div>
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
      </footer>
    </main>
  );
}
