import { useState, type FormEvent } from 'react';
import { Plus, Trash2, Link2, Clock3, ListChecks } from 'lucide-react';
import { routineSchema, type Routine, type Schedule } from '../lib/model';
import { weekDays } from '../lib/schedule';
import { Modal } from './ui/dialog';
import { Button } from './ui/button';
import { CustomSelect } from './ui/select';

export type Template = {
  title: string;
  url: string;
  category: Routine['category'];
  time: string;
  notes: string;
};
export function RoutineForm({
  routine,
  template,
  onClose,
  onSave,
}: {
  routine?: Routine;
  template?: Template;
  onClose: () => void;
  onSave: (routine: Routine) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(routine?.title ?? template?.title ?? '');
  const [url, setUrl] = useState(routine?.url ?? template?.url ?? '');
  const [category, setCategory] = useState<Routine['category']>(
    routine?.category ?? template?.category ?? 'Personal',
  );
  const [notes, setNotes] = useState(routine?.notes ?? template?.notes ?? '');
  const [schedule, setSchedule] = useState<Schedule>(
    routine?.schedule ?? {
      frequency: 'daily',
      time: template?.time ?? '21:00',
      days: [1],
      monthDay: 1,
      interval: 2,
    },
  );
  const [tasks, setTasks] = useState(routine?.tasks ?? []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = routineSchema.safeParse({
      id: routine?.id ?? crypto.randomUUID(),
      title,
      url: url.trim(),
      category,
      notes,
      schedule,
      tasks: tasks.filter((t) => t.title.trim()),
      enabled: routine?.enabled ?? true,
      createdAt: routine?.createdAt ?? Date.now(),
      startAt: routine?.startAt ?? Date.now(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check your routine.');
      return;
    }
    setSaving(true);
    if (await onSave(parsed.data)) onClose();
    else {
      setError('Could not save your routine. Please try again.');
      setSaving(false);
    }
  }
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={routine ? 'Make it your own' : 'A little intention, on repeat.'}
      description={
        routine
          ? 'Update your routine. Previous completions stay in your history.'
          : 'Choose something you want to make time for. We’ll give you a gentle nudge.'
      }
    >
      <form onSubmit={submit} className="routine-form">
        <label>
          Routine name
          <input
            autoFocus
            required
            maxLength={120}
            placeholder="e.g. Catch up on Hacker News"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="form-row">
          <label>
            <span>
              <Link2 size={14} /> Link to open <em>optional</em>
            </span>
            <input
              type="url"
              maxLength={2048}
              placeholder="https://news.ycombinator.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label className="category-select">
            Category
            <CustomSelect
              aria-label="Category"
              value={category}
              onChange={(c) => setCategory(c as Routine['category'])}
              options={['Personal', 'Learning', 'Wellbeing', 'Work']}
            />
          </label>
        </div>
        <div className="form-section">
          <h3>
            <Clock3 size={16} /> Find your rhythm
          </h3>
          <div className="form-row">
            <label>
              Repeat
              <CustomSelect
                aria-label="Repeat"
                value={schedule.frequency}
                onChange={(f) =>
                  setSchedule({ ...schedule, frequency: f as Schedule['frequency'] })
                }
                options={[
                  { value: 'daily', label: 'Every day' },
                  { value: 'weekly', label: 'Selected weekdays' },
                  { value: 'monthly', label: 'Every month' },
                  { value: 'interval', label: 'Every few days' },
                ]}
              />
            </label>
            <label>
              At what time?
              <input
                type="time"
                required
                value={schedule.time}
                onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
              />
            </label>
          </div>
          {schedule.frequency === 'weekly' && (
            <div className="day-picker" aria-label="Days of the week">
              {weekDays.map((day, index) => (
                <Button
                  key={day}
                  type="button"
                  variant={schedule.days.includes(index) ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={schedule.days.includes(index)}
                  onClick={() =>
                    setSchedule({
                      ...schedule,
                      days: schedule.days.includes(index)
                        ? schedule.days.filter((d) => d !== index)
                        : [...schedule.days, index].sort(),
                    })
                  }
                >
                  {day}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSchedule({ ...schedule, days: [1, 2, 3, 4, 5] })}
              >
                Weekdays
              </Button>
            </div>
          )}
          {schedule.frequency === 'monthly' && (
            <label className="mt-3">
              Day of the month
              <input
                type="number"
                min={1}
                max={31}
                required
                value={schedule.monthDay}
                onChange={(e) => setSchedule({ ...schedule, monthDay: Number(e.target.value) })}
              />
              <small>Shorter months use their last day.</small>
            </label>
          )}
          {schedule.frequency === 'interval' && (
            <label className="mt-3">
              Repeat every N days
              <input
                type="number"
                min={1}
                max={365}
                required
                value={schedule.interval}
                onChange={(e) => setSchedule({ ...schedule, interval: Number(e.target.value) })}
              />
              <small>Counted from the day you save this schedule.</small>
            </label>
          )}
          <p className="field-hint">
            Your local time ·{' '}
            {Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ')}
          </p>
        </div>
        <div className="form-section">
          <h3>
            <ListChecks size={16} /> A few small steps <em>optional</em>
          </h3>
          <div className="task-editor">
            {tasks.map((task, i) => (
              <div key={task.id}>
                <span className="empty-checkbox" />
                <input
                  aria-label={`Step ${i + 1}`}
                  maxLength={200}
                  placeholder="Add a small action…"
                  value={task.title}
                  onChange={(e) =>
                    setTasks(
                      tasks.map((t) => (t.id === task.id ? { ...t, title: e.target.value } : t)),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove step ${i + 1}`}
                  onClick={() => setTasks(tasks.filter((t) => t.id !== task.id))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={tasks.length >= 50}
            onClick={() => setTasks([...tasks, { id: crypto.randomUUID(), title: '' }])}
          >
            <Plus /> Add a step
          </Button>
          <label className="mt-4">
            Notes
            <textarea
              rows={3}
              maxLength={10000}
              placeholder="A reminder, an intention, anything worth keeping…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : routine ? 'Save changes' : 'Create routine'}
            <Plus />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
