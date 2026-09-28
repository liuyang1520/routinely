import { useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  ExternalLink,
  ListTodo,
  Moon,
  Monitor,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Sun,
} from 'lucide-react';
import { useStore } from '../hooks/use-store';
import { useTheme } from '../hooks/use-theme';
import { forDay, scheduleLabel, timeLabel } from '../lib/schedule';
import { openDashboard } from '../lib/client';
import type { Routine } from '../lib/model';
import { Brand } from './Brand';
import { Button } from './ui/button';
import { RoutineIcon, OccurrenceCard } from './OccurrenceCard';
import { QuickDelay } from './QuickDelay';
import { RoutineForm, type Template } from './RoutineForm';
import { PageLink } from './PageLink';

type PopoverView = 'today' | 'daily' | 'weekly' | 'all';

export function Popup() {
  const { state, act, error } = useStore();
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<PopoverView>('today');
  const [form, setForm] = useState<{ routine?: Routine; template?: Template }>();

  const todayItems = state ? forDay(state, new Date()) : [];
  const routines = state?.routines ?? [];
  const dailyRoutines = routines.filter((r) => r.schedule.frequency === 'daily');
  const weeklyRoutines = routines.filter((r) => r.schedule.frequency === 'weekly');
  const allRoutines = routines;

  const todayCompleted = todayItems.filter((o) => o.status === 'completed').length;
  const todayPending = todayItems.filter((o) => o.status === 'pending').length;

  return (
    <main className="popup">
      <header>
        <Brand small />
        <div className="popup-header-actions">
          <Button
            size="icon"
            variant="ghost"
            aria-label="New routine"
            title="New routine"
            onClick={() => setForm({})}
          >
            <Plus size={17} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Theme: ${theme}. Switch to ${theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'} mode`}
            title={`Theme: ${theme}`}
            onClick={toggleTheme}
          >
            {theme === 'system' ? (
              <Monitor size={17} />
            ) : theme === 'dark' ? (
              <Sun size={17} />
            ) : (
              <Moon size={17} />
            )}
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
      <QuickDelay
        act={act}
        onMakeRoutine={(tmpl) =>
          setForm({
            template: {
              ...tmpl,
              label: '',
              time: '21:00',
              notes: '',
            },
          })
        }
      />

      <div className="popup-nav" role="tablist" aria-label="Routine views">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'today'}
          className={view === 'today' ? 'active' : ''}
          onClick={() => setView('today')}
        >
          Today
          {todayPending > 0 && <span className="tab-badge">{todayPending}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'daily'}
          className={view === 'daily' ? 'active' : ''}
          onClick={() => setView('daily')}
        >
          Daily
          {dailyRoutines.length > 0 && <span className="tab-badge">{dailyRoutines.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'weekly'}
          className={view === 'weekly' ? 'active' : ''}
          onClick={() => setView('weekly')}
        >
          Weekly
          {weeklyRoutines.length > 0 && <span className="tab-badge">{weeklyRoutines.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'all'}
          className={view === 'all' ? 'active' : ''}
          onClick={() => setView('all')}
        >
          All
          {allRoutines.length > 0 && <span className="tab-badge">{allRoutines.length}</span>}
        </button>
      </div>

      <div className="popup-heading">
        <div className="popup-heading-content">
          <span>
            {view === 'today' && <Sun size={14} />}
            {view === 'daily' && <Repeat size={14} />}
            {view === 'weekly' && <CalendarDays size={14} />}
            {view === 'all' && <ListTodo size={14} />}
            {view === 'today' &&
              new Date().toLocaleDateString([], {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            {view === 'daily' && 'Daily rhythms'}
            {view === 'weekly' && 'Weekly rhythms'}
            {view === 'all' && 'All routines'}
          </span>
          <p>
            {view === 'today' && `${todayCompleted} of ${todayItems.length} completed`}
            {view === 'daily' &&
              `${dailyRoutines.filter((r) => r.enabled).length} active · ${dailyRoutines.filter((r) => !r.enabled).length} paused`}
            {view === 'weekly' &&
              `${weeklyRoutines.filter((r) => r.enabled).length} active · ${weeklyRoutines.filter((r) => !r.enabled).length} paused`}
            {view === 'all' &&
              `${allRoutines.filter((r) => r.enabled).length} of ${allRoutines.length} active`}
          </p>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="popup-list">
        {view === 'today' && (
          <>
            {todayItems.map((item) => (
              <OccurrenceCard key={item.id} item={item} act={act} compact minimal />
            ))}
            {state && todayItems.length === 0 && (
              <div className="popup-empty">
                <Sun size={28} />
                <h2>Your day has a little space.</h2>
                <p>Add a routine to give something good a place in it.</p>
              </div>
            )}
          </>
        )}

        {view === 'daily' && (
          <>
            {dailyRoutines.map((r) => {
              const occ = todayItems.find((o) => o.routineId === r.id);
              if (occ && r.enabled) {
                return <OccurrenceCard key={occ.id} item={occ} act={act} compact minimal />;
              }
              return (
                <article key={r.id} className={`managed-routine ${!r.enabled ? 'paused' : ''}`}>
                  <RoutineIcon />
                  <div className="managed-routine-copy">
                    <h3>
                      {r.title}
                      {!r.enabled && <span className="status-tag">Paused</span>}
                    </h3>
                    <p>
                      {scheduleLabel(r.schedule)} · {timeLabel(r.schedule.time)}
                    </p>
                    {r.url && (
                      <PageLink href={r.url} target="_blank" rel="noopener noreferrer">
                        {new URL(r.url).hostname}
                        <ExternalLink size={11} />
                      </PageLink>
                    )}
                  </div>
                  <div className="routine-controls">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${r.enabled ? 'Pause' : 'Resume'} ${r.title}`}
                      onClick={() => void act({ type: 'toggle-routine', id: r.id })}
                    >
                      {r.enabled ? <Pause size={14} /> : <Play size={14} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${r.title}`}
                      onClick={() => setForm({ routine: r })}
                    >
                      <Pencil size={14} />
                    </Button>
                  </div>
                </article>
              );
            })}
            {state && dailyRoutines.length === 0 && (
              <div className="popup-empty">
                <Repeat size={28} />
                <h2>No daily routines yet.</h2>
                <p>Add a daily routine to build steady momentum.</p>
              </div>
            )}
          </>
        )}

        {view === 'weekly' && (
          <>
            {weeklyRoutines.map((r) => {
              const occ = todayItems.find((o) => o.routineId === r.id);
              if (occ && r.enabled) {
                return <OccurrenceCard key={occ.id} item={occ} act={act} compact minimal />;
              }
              return (
                <article key={r.id} className={`managed-routine ${!r.enabled ? 'paused' : ''}`}>
                  <RoutineIcon />
                  <div className="managed-routine-copy">
                    <h3>
                      {r.title}
                      {!r.enabled && <span className="status-tag">Paused</span>}
                    </h3>
                    <p>
                      {scheduleLabel(r.schedule)} · {timeLabel(r.schedule.time)}
                    </p>
                    {r.url && (
                      <PageLink href={r.url} target="_blank" rel="noopener noreferrer">
                        {new URL(r.url).hostname}
                        <ExternalLink size={11} />
                      </PageLink>
                    )}
                  </div>
                  <div className="routine-controls">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${r.enabled ? 'Pause' : 'Resume'} ${r.title}`}
                      onClick={() => void act({ type: 'toggle-routine', id: r.id })}
                    >
                      {r.enabled ? <Pause size={14} /> : <Play size={14} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${r.title}`}
                      onClick={() => setForm({ routine: r })}
                    >
                      <Pencil size={14} />
                    </Button>
                  </div>
                </article>
              );
            })}
            {state && weeklyRoutines.length === 0 && (
              <div className="popup-empty">
                <CalendarDays size={28} />
                <h2>No weekly routines yet.</h2>
                <p>Give weekly rituals their own space in your week.</p>
              </div>
            )}
          </>
        )}

        {view === 'all' && (
          <>
            {allRoutines.map((r) => {
              const occ = todayItems.find((o) => o.routineId === r.id);
              if (occ && r.enabled) {
                return <OccurrenceCard key={occ.id} item={occ} act={act} compact minimal />;
              }
              return (
                <article key={r.id} className={`managed-routine ${!r.enabled ? 'paused' : ''}`}>
                  <RoutineIcon />
                  <div className="managed-routine-copy">
                    <h3>
                      {r.title}
                      {!r.enabled && <span className="status-tag">Paused</span>}
                    </h3>
                    <p>
                      {scheduleLabel(r.schedule)} · {timeLabel(r.schedule.time)}
                    </p>
                    {r.url && (
                      <PageLink href={r.url} target="_blank" rel="noopener noreferrer">
                        {new URL(r.url).hostname}
                        <ExternalLink size={11} />
                      </PageLink>
                    )}
                  </div>
                  <div className="routine-controls">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${r.enabled ? 'Pause' : 'Resume'} ${r.title}`}
                      onClick={() => void act({ type: 'toggle-routine', id: r.id })}
                    >
                      {r.enabled ? <Pause size={14} /> : <Play size={14} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${r.title}`}
                      onClick={() => setForm({ routine: r })}
                    >
                      <Pencil size={14} />
                    </Button>
                  </div>
                </article>
              );
            })}
            {state && allRoutines.length === 0 && (
              <div className="popup-empty">
                <ListTodo size={28} />
                <h2>No routines yet.</h2>
                <p>Create a routine to start building your rituals.</p>
              </div>
            )}
          </>
        )}
      </div>

      {form && (
        <RoutineForm
          routine={form.routine}
          template={form.template}
          onClose={() => setForm(undefined)}
          onSave={async (routine) => {
            const ok = await act({ type: 'save-routine', routine });
            if (ok) setForm(undefined);
            return ok;
          }}
        />
      )}
    </main>
  );
}
