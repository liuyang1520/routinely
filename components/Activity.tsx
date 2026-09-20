import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Check,
  CalendarDays,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react';
import type { Action, State } from '../lib/model';
import { addDays, dayKey, startOfDay, timeLabel } from '../lib/schedule';
import { download, historyCsv } from '../lib/export';
import { Button } from './ui/button';
import { CustomSelect } from './ui/select';

export function Activity({
  state,
  act,
}: {
  state: State;
  act: (action: Action) => Promise<boolean>;
}) {
  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const recent = state.occurrences.filter(
    (o) =>
      o.scheduledAt >= addDays(startOfDay(Date.now()), -29).getTime() &&
      (o.scheduledAt <= Date.now() || o.status !== 'pending'),
  );
  const completed = recent.filter((o) => o.status === 'completed').length;
  const settled = recent.filter((o) => o.status !== 'pending');
  const rate = settled.length ? Math.round((completed / settled.length) * 100) : 0;
  const activeDays = new Set(
    recent.filter((o) => o.status === 'completed').map((o) => dayKey(o.scheduledAt)),
  ).size;
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const start = addDays(startOfDay(Date.now()), -27 + index * 7);
    const end = addDays(start, 7);
    const items = recent.filter(
      (o) => o.scheduledAt >= start.getTime() && o.scheduledAt < end.getTime(),
    );
    return {
      label: start.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      completed: items.filter((o) => o.status === 'completed').length,
      total: items.length,
    };
  });
  const max = Math.max(1, ...weeks.map((w) => w.total));
  const start = addDays(month, -((month.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const history = state.occurrences
    .filter(
      (o) =>
        (!selected || dayKey(o.scheduledAt) === selected) &&
        (filter === 'all' || o.status === filter),
    )
    .sort((a, b) => b.scheduledAt - a.scheduledAt);
  const [limit, setLimit] = useState(30);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE BIGGER PICTURE</p>
          <h1>Little steps add up.</h1>
          <p>Some perspective on the routines you’re making room for.</p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            download(
              `routinely-history-${dayKey(Date.now())}.csv`,
              historyCsv(state),
              'text/csv;charset=utf-8',
            )
          }
        >
          <Download />
          Export history
        </Button>
      </div>
      <div className="stats-grid">
        <div>
          <span>Completed check-ins</span>
          <strong>
            {completed}
            <small>in the last 30 days</small>
          </strong>
          <Check />
        </div>
        <div>
          <span>Completion rate</span>
          <strong>
            {settled.length ? `${rate}%` : '—'}
            <small>of completed, skipped & missed</small>
          </strong>
          <ArrowUpRight />
        </div>
        <div>
          <span>Days you showed up</span>
          <strong>
            {activeDays}
            <small>in the last 30 days</small>
          </strong>
          <CalendarDays />
        </div>
      </div>
      <div className="analytics-grid">
        <section className="surface calendar">
          <div className="section-title">
            <h2>
              <CalendarDays size={17} /> Your check-in calendar
            </h2>
            <div className="calendar-controls">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous month"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                <ChevronLeft />
              </Button>
              <span>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next month"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
          <div className="calendar-grid">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <span className="calendar-weekday" key={i}>
                {d}
              </span>
            ))}
            {days.map((day) => {
              const items = state.occurrences.filter((o) => dayKey(o.scheduledAt) === dayKey(day));
              const done = items.filter((o) => o.status === 'completed').length;
              const level = done === 0 ? 0 : done === items.length ? 3 : 1;
              return (
                <button
                  key={dayKey(day)}
                  className={`calendar-day level-${level} ${day.getMonth() !== month.getMonth() ? 'outside' : ''} ${selected === dayKey(day) ? 'selected' : ''} ${dayKey(day) === dayKey(Date.now()) ? 'today' : ''}`}
                  aria-label={`${day.toLocaleDateString()}: ${done} completed of ${items.length} check-ins`}
                  aria-pressed={selected === dayKey(day)}
                  onClick={() => setSelected(selected === dayKey(day) ? null : dayKey(day))}
                >
                  <span>{day.getDate()}</span>
                  {items.length > 0 && <i />}
                </button>
              );
            })}
          </div>
          <div className="calendar-legend">
            <span>Less</span>
            <i className="level-0" />
            <i className="level-1" />
            <i className="level-3" />
            <span>More completed</span>
          </div>
        </section>
        <section className="surface weekly-chart">
          <div className="section-title">
            <h2>
              <BarChart3 size={17} /> A steady rhythm
            </h2>
            <span className="muted text-xs">Last 4 weeks</span>
          </div>
          <div
            className="chart-bars"
            role="img"
            aria-label={weeks
              .map((w) => `${w.label}: ${w.completed} completed out of ${w.total}`)
              .join('. ')}
          >
            {weeks.map((w) => (
              <div className="bar-group" key={w.label}>
                <strong>{w.completed}</strong>
                <div className="bar-track">
                  <div
                    className="bar-total"
                    style={{ height: `${Math.max(2, (w.total / max) * 100)}%` }}
                  >
                    <div
                      className="bar-fill"
                      style={{ height: `${w.total ? (w.completed / w.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span>{w.label}</span>
              </div>
            ))}
          </div>
          <p>
            <i />
            Completed{' '}
            <span>
              <i />
              Scheduled
            </span>
          </p>
        </section>
      </div>
      <section className="history-section">
        <div className="section-title">
          <h2>Check-in history {selected && <span className="muted">· {selected}</span>}</h2>
          <div className="flex gap-2">
            {selected && (
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Clear date
              </Button>
            )}
            <CustomSelect
              aria-label="Filter history by status"
              value={filter}
              onChange={(val) => {
                setFilter(val);
                setLimit(30);
              }}
              options={[
                { value: 'all', label: 'All results' },
                { value: 'completed', label: 'Completed' },
                { value: 'pending', label: 'Pending' },
                { value: 'skipped', label: 'Skipped' },
                { value: 'missed', label: 'Missed' },
              ]}
            />
          </div>
        </div>
        {history.length === 0 ? (
          <div className="empty-history">
            <CalendarDays />
            <h3>Your story starts with a check-in.</h3>
            <p>
              {selected || filter !== 'all'
                ? 'No check-ins match this filter.'
                : 'Once a routine comes due or you complete one, it will appear here.'}
            </p>
          </div>
        ) : (
          <>
            <div className="history-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Routine</th>
                    <th>Scheduled</th>
                    <th>Result</th>
                    <th>Steps</th>
                    <th>
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, limit).map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>{o.title}</strong>
                        <small>
                          {o.category}
                          {o.notes ? ` · ${o.notes.slice(0, 90)}` : ''}
                        </small>
                      </td>
                      <td>
                        {new Date(o.scheduledAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                        <small>{timeLabel(o.scheduledAt)}</small>
                      </td>
                      <td>
                        <span className={`status-tag status-${o.status}`}>{o.status}</span>
                        {o.completedAt && <small>{timeLabel(o.completedAt)}</small>}
                      </td>
                      <td>
                        {o.tasks.length
                          ? `${o.tasks.filter((t) => t.done).length}/${o.tasks.length}`
                          : '—'}
                      </td>
                      <td>
                        {o.status !== 'completed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void act({ type: 'complete', id: o.id })}
                          >
                            Mark done
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {history.length > limit && (
              <Button className="mt-4" variant="outline" onClick={() => setLimit(limit + 30)}>
                Show more
              </Button>
            )}
          </>
        )}
      </section>
    </>
  );
}
