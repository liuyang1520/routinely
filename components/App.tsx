import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  ExternalLink,
  ListTodo,
  Moon,
  Monitor,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { useStore } from '../hooks/use-store';
import { useTheme } from '../hooks/use-theme';
import { useStorageUsage } from '../hooks/use-storage-usage';
import { dayKey, addDays, forDay, scheduleLabel, startOfDay, timeLabel } from '../lib/schedule';
import { weeklyNote } from '../lib/insights';
import type { Routine } from '../lib/model';
import { download } from '../lib/export';
import { Brand } from './Brand';
import { Button } from './ui/button';
import { Confirm, Modal } from './ui/dialog';
import { CustomSelect } from './ui/select';
import { RoutineForm, type Template } from './RoutineForm';
import { RoutineIcon, OccurrenceCard } from './OccurrenceCard';
import { Activity } from './Activity';
import { Settings } from './Settings';
import { ReminderPreview } from './ReminderPanel';
import { Later } from './Later';
import { PageLink } from './PageLink';
import { PauseRoutineDialog } from './PauseRoutineDialog';
import { Scratchpad } from './Scratchpad';

type Page = 'today' | 'routines' | 'later' | 'activity' | 'settings';
const templates: Template[] = [
  {
    title: 'Read for 10 minutes',
    url: '',
    label: 'Learning',
    time: '21:00',
    notes: 'A little time with something worth reading.',
  },
  {
    title: 'Take a screen break',
    url: '',
    label: 'Wellbeing',
    time: '14:00',
    notes: 'Stand up, stretch, and look into the distance.',
  },
  {
    title: 'Plan a little for tomorrow',
    url: '',
    label: 'Personal',
    time: '20:30',
    notes: 'What is one thing that would make tomorrow a good day?',
  },
];
export function App() {
  const { state, act, error, clearError } = useStore();
  const storageUsage = useStorageUsage(state);
  const [page, setPage] = useState<Page>('today');
  const [date, setDate] = useState(startOfDay(Date.now()));
  const [search, setSearch] = useState('');
  const [filterLabel, setFilterLabel] = useState('');
  const [form, setForm] = useState<{ routine?: Routine; template?: Template }>();
  const [remove, setRemove] = useState<Routine>();
  const [pauseRoutine, setPauseRoutine] = useState<Routine>();
  const [preview, setPreview] = useState(false);
  const [help, setHelp] = useState(false);
  const { theme, setTheme, toggleTheme } = useTheme();
  const note = useMemo(() => state && weeklyNote(state), [state]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === 'n' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !(
          event.target instanceof HTMLElement &&
          (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) ||
            event.target.isContentEditable)
        ) &&
        !document.querySelector('[role="dialog"]')
      ) {
        event.preventDefault();
        setForm({});
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  if (!state)
    return (
      <div className="loading-screen">
        <Brand />
        <p>{error || 'Making a little room for your day…'}</p>
        {error && <Button onClick={() => location.reload()}>Try again</Button>}
      </div>
    );
  const labels = [...new Set(state.routines.map((r) => r.label).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  const today = forDay(state, new Date());
  const items = forDay(state, date).filter(
    (o) =>
      (!filterLabel || o.label === filterLabel) &&
      o.title.toLowerCase().includes(search.toLowerCase()),
  );
  const remaining = items.filter((o) => o.status === 'pending');
  const finished = items.filter((o) => o.status !== 'pending');
  const weekStart = addDays(date, -((date.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const active = state.routines.filter((r) => r.enabled);
  const isToday = dayKey(date) === dayKey(Date.now());
  const filteredRoutines = state.routines
    .filter(
      (r) =>
        r.title.toLowerCase().includes(search.toLowerCase()) &&
        (!filterLabel || r.label === filterLabel),
    )
    .sort((a, b) => a.schedule.time.localeCompare(b.schedule.time));
  const changePage = (value: Page) => {
    setPage(value);
    setSearch('');
    setFilterLabel('');
  };
  const storagePercent = storageUsage?.quotaBytes
    ? Math.round((storageUsage.bytes / storageUsage.quotaBytes) * 100)
    : 0;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            changePage('today');
          }}
          aria-label="Routinely home"
        >
          <Brand />
        </a>
        <div className="workspace-label">YOUR LITTLE CORNER</div>
        <nav aria-label="Main navigation">
          {(
            [
              { id: 'today', icon: Sun, title: 'Today' },
              { id: 'routines', icon: ListTodo, title: 'My routines' },
              { id: 'later', icon: Clock3, title: 'View later' },
              { id: 'activity', icon: BarChart3, title: 'Activity' },
            ] as const
          ).map(({ id, icon: Icon, title }) => (
            <button
              key={id}
              aria-label={title}
              className={page === id ? 'active' : ''}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => changePage(id)}
            >
              <Icon size={18} />
              <span>{title}</span>
              {id === 'today' && today.filter((o) => o.status === 'pending').length > 0 && (
                <small>{today.filter((o) => o.status === 'pending').length}</small>
              )}
              {id === 'later' && state.delayedViews.some((v) => v.status === 'scheduled') && (
                <small>{state.delayedViews.filter((v) => v.status === 'scheduled').length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <nav aria-label="Tools">
            <button
              aria-label="Export data"
              onClick={() =>
                download(
                  `routinely-backup-${dayKey(Date.now())}.json`,
                  JSON.stringify(state, null, 2),
                )
              }
            >
              <ArrowDownToLine size={17} />
              <span>Export data</span>
            </button>
            <button
              aria-label="Settings"
              className={page === 'settings' ? 'active' : ''}
              onClick={() => changePage('settings')}
            >
              <Settings2 size={17} />
              <span>Settings</span>
            </button>
            <button aria-label="A little help" onClick={() => setHelp(true)}>
              <CircleHelp size={17} />
              <span>A little help</span>
            </button>
          </nav>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span>Your space</span>
            <ChevronRight size={13} />
            <strong>
              {page === 'today'
                ? isToday
                  ? 'Today'
                  : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
                : page === 'routines'
                  ? 'My routines'
                  : page === 'later'
                    ? 'View later'
                    : page === 'activity'
                      ? 'Activity'
                      : 'Settings'}
            </strong>
          </div>
          <div className="topbar-right">
            <Button
              variant="ghost"
              size="icon"
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
              variant="ghost"
              size="icon"
              aria-label="Preview a reminder"
              onClick={() => setPreview(true)}
            >
              <Bell />
            </Button>
          </div>
        </header>
        <main className="main-content">
          {page !== 'settings' && storagePercent >= 70 && (
            <div className="storage-warning" role={storagePercent >= 90 ? 'alert' : 'status'}>
              <span>
                Storage is {storagePercent >= 90 ? 'almost full' : 'getting full'} ({storagePercent}
                % used). Export a backup and review old history.
              </span>
              <Button variant="outline" size="sm" onClick={() => changePage('settings')}>
                Review storage
              </Button>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <Button size="icon" variant="ghost" aria-label="Dismiss error" onClick={clearError}>
                <X />
              </Button>
            </div>
          )}
          {page === 'activity' ? (
            <Activity state={state} act={act} />
          ) : page === 'later' ? (
            <Later
              state={state}
              act={act}
              onMakeRoutine={(item) =>
                setForm({
                  template: {
                    title: item.title,
                    url: item.url,
                    label: '',
                    time: '21:00',
                    notes: '',
                  },
                })
              }
            />
          ) : page === 'settings' ? (
            <Settings
              state={state}
              act={act}
              usage={storageUsage}
              onPreview={() => setPreview(true)}
              theme={theme}
              setTheme={setTheme}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    {page === 'today'
                      ? date
                          .toLocaleDateString([], {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                          })
                          .toUpperCase()
                      : 'INTENTIONS, WITH A LITTLE STRUCTURE'}
                  </p>
                  <h1>
                    {page === 'today'
                      ? isToday
                        ? 'Good habits. A little at a time.'
                        : `A little space for ${date.toLocaleDateString([], { weekday: 'long' })}.`
                      : 'Your rhythm, your routines.'}
                    <span className="heading-dot"> </span>
                  </h1>
                  <p>
                    {page === 'today'
                      ? isToday
                        ? 'A calmer place for the things you want to keep coming back to.'
                        : 'The small things you made room for on this day.'
                      : 'Small things worth making time for. All in one place.'}
                  </p>
                </div>
                <Button onClick={() => setForm({})}>
                  <Plus />
                  New routine <kbd>N</kbd>
                </Button>
              </div>
              {page === 'today' && (
                <div className="today-layout">
                  <div className="today-main">
                    <section className="week-section">
                      <div className="section-title">
                        <h2>{date.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2>
                        <div className="flex items-center gap-1">
                          {!isToday && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDate(startOfDay(Date.now()))}
                            >
                              Today
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Previous week"
                            onClick={() => setDate(addDays(date, -7))}
                          >
                            <ChevronLeft />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Next week"
                            onClick={() => setDate(addDays(date, 7))}
                          >
                            <ChevronRight />
                          </Button>
                        </div>
                      </div>
                      <div className="week-strip">
                        {week.map((day) => {
                          const count = forDay(state, day).length;
                          return (
                            <button
                              key={dayKey(day)}
                              className={`${dayKey(date) === dayKey(day) ? 'selected' : ''} ${dayKey(day) === dayKey(Date.now()) ? 'is-today' : ''}`}
                              aria-label={day.toLocaleDateString([], {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                              })}
                              aria-pressed={dayKey(date) === dayKey(day)}
                              onClick={() => setDate(day)}
                            >
                              <span>{day.toLocaleDateString([], { weekday: 'short' })}</span>
                              <strong>{day.getDate()}</strong>
                              <i className={count ? 'has-routines' : ''} />
                            </button>
                          );
                        })}
                      </div>
                    </section>
                    {isToday && note && (
                      <div className="weekly-note">
                        <Sparkles size={15} />
                        <span>{note}</span>
                      </div>
                    )}
                    <div className="routine-toolbar">
                      <div className="filter-tabs">
                        {['', ...labels].map((c) => (
                          <button
                            key={c || 'all'}
                            className={filterLabel === c ? 'selected' : ''}
                            onClick={() => setFilterLabel(c)}
                          >
                            {c || 'All routines'}
                          </button>
                        ))}
                      </div>
                      <span>{items.length} planned</span>
                    </div>
                    <div className="section-title upcoming-title">
                      <h2>
                        {isToday
                          ? 'On your list today'
                          : date.toLocaleDateString([], {
                              weekday: 'long',
                              month: 'short',
                              day: 'numeric',
                            })}
                        <span className="count-tag">{remaining.length}</span>
                      </h2>
                      <span className="muted text-xs">
                        <Clock3 size={12} /> Your local time
                      </span>
                    </div>
                    {remaining.length > 0 ? (
                      <div className="occurrence-list">
                        {remaining.map((item) => (
                          <OccurrenceCard
                            key={item.id}
                            item={item}
                            act={act}
                            readOnly={dayKey(date) > dayKey(Date.now())}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="empty-routines">
                        <div className="empty-badge">
                          <CheckCheck size={32} />
                        </div>
                        <h2>
                          {state.routines.length === 0
                            ? 'A fresh start feels good.'
                            : finished.length > 0
                              ? 'A little breathing room.'
                              : 'A little room in your day.'}
                        </h2>
                        <p>
                          {state.routines.length === 0
                            ? 'Start with one small thing you’d like to come back to.\nWe’ll help you make it a routine.'
                            : finished.length > 0
                              ? 'You’ve worked through this list. Take a moment for yourself.'
                              : 'No routines here for this day or filter. Enjoy the space, or add something meaningful.'}
                        </p>
                        <Button variant="outline" onClick={() => setForm({})}>
                          <Plus />
                          {state.routines.length === 0
                            ? 'Create your first routine'
                            : 'Add a routine'}
                        </Button>
                      </div>
                    )}
                    {finished.length > 0 && (
                      <section className="finished-section">
                        <div className="section-title">
                          <h2>
                            Checked in<span className="count-tag">{finished.length}</span>
                          </h2>
                          <CheckCheck size={16} />
                        </div>
                        <div className="occurrence-list">
                          {finished.map((item) => (
                            <OccurrenceCard key={item.id} item={item} act={act} />
                          ))}
                        </div>
                      </section>
                    )}
                    {isToday && <Scratchpad value={state.scratchpad} act={act} />}
                    {state.routines.length === 0 && (
                      <div className="starter-section">
                        <div className="section-title">
                          <h2>
                            <Sparkles size={15} />A little inspiration to get you going
                          </h2>
                          <span className="muted text-xs">Start small</span>
                        </div>
                        <div className="starter-grid">
                          {templates.map((t) => (
                            <button
                              key={t.title}
                              className="starter-card"
                              onClick={() => setForm({ template: t })}
                            >
                              <RoutineIcon />
                              <strong>{t.title}</strong>
                              <span>
                                {t.label} · {timeLabel(t.time)}
                              </span>
                              <ArrowRight size={15} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {page === 'routines' && (
                <>
                  <div className="routine-management-toolbar">
                    <label className="search-input">
                      <Search size={17} />
                      <input
                        aria-label="Search routines"
                        placeholder="Find a routine…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <CustomSelect
                      aria-label="Filter routines by label"
                      value={filterLabel}
                      onChange={setFilterLabel}
                      options={[
                        { value: '', label: 'All routines' },
                        ...labels.map((label) => ({ value: label, label })),
                      ]}
                    />
                    <span className="muted">
                      {active.length} active · {state.routines.length - active.length} paused
                    </span>
                  </div>
                  <div className="managed-routines">
                    {filteredRoutines.map((r) => (
                      <article
                        key={r.id}
                        className={`managed-routine ${!r.enabled ? 'paused' : ''}`}
                      >
                        <RoutineIcon />
                        <div className="managed-routine-copy">
                          <h2>
                            {r.title}
                            {!r.enabled && <span className="status-tag">Paused</span>}
                          </h2>
                          <p>
                            {scheduleLabel(r.schedule)}
                            <span>·</span>
                            {timeLabel(r.schedule.time)}
                            {r.label && (
                              <>
                                <span>·</span>
                                {r.label}
                              </>
                            )}
                            {r.pausedUntil && (
                              <>
                                <span>·</span>
                                Resumes{' '}
                                {new Date(r.pausedUntil).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </>
                            )}
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
                            onClick={() =>
                              r.enabled
                                ? setPauseRoutine(r)
                                : void act({ type: 'toggle-routine', id: r.id })
                            }
                          >
                            {r.enabled ? <Pause /> : <Play />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${r.title}`}
                            onClick={() => setForm({ routine: r })}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${r.title}`}
                            onClick={() => setRemove(r)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {filteredRoutines.length === 0 && (
                    <div className="empty-routines">
                      <ListTodo size={32} />
                      <h2>
                        {state.routines.length
                          ? 'No routines found.'
                          : 'Every rhythm starts somewhere.'}
                      </h2>
                      <p>
                        {state.routines.length
                          ? 'Try a different search or label.'
                          : 'Add your first routine and make a little room for what matters.'}
                      </p>
                      <Button onClick={() => setForm({})}>
                        <Plus />
                        New routine
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
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
      <Confirm
        open={!!remove}
        onOpenChange={(open) => {
          if (!open) setRemove(undefined);
        }}
        title="Let this routine go?"
        description={`“${remove?.title ?? ''}” will be removed. Previous check-ins stay in your history, and pending check-ins will be skipped.`}
        label="Delete routine"
        onConfirm={() => {
          if (remove) void act({ type: 'delete-routine', id: remove.id });
          setRemove(undefined);
        }}
      />
      {preview && (
        <ReminderPreview
          position={state.settings.position}
          onClose={() => setPreview(false)}
          theme={theme}
        />
      )}
      <Modal
        open={help}
        onOpenChange={setHelp}
        title="A little help, when you need it."
        description="Routinely is a small space for intentions you want to keep."
      >
        <div className="help-content">
          <h3>Start with a routine</h3>
          <p>
            Choose a title, an optional link and label, and a schedule. Press N anywhere on the
            dashboard to create one. New schedules begin from the time you save them.
          </p>
          <h3>Show up in your own way</h3>
          <p>
            When it’s time, the toolbar shows due routines. Floating reminders appear on the
            matching page for linked routines, or on your active webpage for routines without a
            link. Open the link, leave a note, complete the check-in, or snooze for 10 minutes or
            until later today. Opening a link never marks a routine complete; choose Done when you
            have done it. Closing a reminder dismisses it for this page visit.
          </p>
          <h3>Keep a little perspective</h3>
          <p>
            Activity shows your check-ins, calendar, and weekly totals. Upcoming check-ins don’t
            count against your completion rate. Missed and skipped check-ins do.
          </p>
          <h3>Come back to a page later</h3>
          <p>
            Open the toolbar popup on a webpage and choose 1 hour, 3 hours, 1 day, or a custom time.
            We’ll switch to its tab or reopen it if it’s closed. Reschedule or cancel it in View
            later. Routine links also reuse existing tabs; automatic switching for routine reminders
            can be turned on in Settings.
          </p>
          <h3>Keep what’s yours</h3>
          <p>
            Export a full JSON backup from the sidebar, or a CSV of your history from Activity.
            Restore backups in Settings. Your data stays on this device.
          </p>
        </div>
      </Modal>
    </div>
  );
}
