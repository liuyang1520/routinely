import { useState } from 'react';
import {
  ArrowUpRight,
  ExternalLink,
  ListTodo,
  Moon,
  Monitor,
  Pause,
  Pencil,
  Play,
  Plus,
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
import { PauseRoutineDialog } from './PauseRoutineDialog';

type PopoverView = 'today' | 'routines';

export function Popup() {
  const { state, act, error } = useStore();
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<PopoverView>('today');
  const [form, setForm] = useState<{ routine?: Routine; template?: Template }>();
  const [pauseRoutine, setPauseRoutine] = useState<Routine>();

  const todayItems = state
    ? forDay(state, new Date()).sort(
        (a, b) =>
          Number(a.status !== 'pending') - Number(b.status !== 'pending') ||
          a.scheduledAt - b.scheduledAt,
      )
    : [];
  const routines = state?.routines ?? [];
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
          aria-selected={view === 'routines'}
          className={view === 'routines' ? 'active' : ''}
          onClick={() => setView('routines')}
        >
          Routines
          {routines.length > 0 && <span className="tab-badge">{routines.length}</span>}
        </button>
      </div>

      <div className="popup-heading">
        <div className="popup-heading-content">
          <span>
            {view === 'today' ? <Sun size={14} /> : <ListTodo size={14} />}
            {view === 'today'
              ? new Date().toLocaleDateString([], {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })
              : 'All routines'}
          </span>
          <p>
            {view === 'today'
              ? `${todayCompleted} of ${todayItems.length} completed`
              : `${routines.filter((r) => r.enabled).length} active · ${routines.filter((r) => !r.enabled).length} paused`}
          </p>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="popup-list">
        {view === 'today' ? (
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
        ) : (
          <>
            {routines.map((routine) => (
              <article
                key={routine.id}
                className={`managed-routine ${!routine.enabled ? 'paused' : ''}`}
              >
                <RoutineIcon />
                <div className="managed-routine-copy">
                  <h3>
                    {routine.title}
                    {!routine.enabled && <span className="status-tag">Paused</span>}
                  </h3>
                  <p>
                    {scheduleLabel(routine.schedule)} · {timeLabel(routine.schedule.time)}
                    {routine.pausedUntil &&
                      ` · Resumes ${new Date(routine.pausedUntil).toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
                  </p>
                  {routine.url && (
                    <PageLink href={routine.url} target="_blank" rel="noopener noreferrer">
                      {new URL(routine.url).hostname}
                      <ExternalLink size={11} />
                    </PageLink>
                  )}
                </div>
                <div className="routine-controls">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${routine.enabled ? 'Pause' : 'Resume'} ${routine.title}`}
                    onClick={() =>
                      routine.enabled
                        ? setPauseRoutine(routine)
                        : void act({ type: 'toggle-routine', id: routine.id })
                    }
                  >
                    {routine.enabled ? <Pause size={14} /> : <Play size={14} />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${routine.title}`}
                    onClick={() => setForm({ routine })}
                  >
                    <Pencil size={14} />
                  </Button>
                </div>
              </article>
            ))}
            {state && routines.length === 0 && (
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
          onSave={(routine) => act({ type: 'save-routine', routine })}
        />
      )}
      {pauseRoutine && (
        <PauseRoutineDialog
          routine={pauseRoutine}
          act={act}
          onClose={() => setPauseRoutine(undefined)}
        />
      )}
    </main>
  );
}
