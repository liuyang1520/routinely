import { actionSchema, type Action, type State } from './model';
import { forDay, reconcile } from './schedule';

export function reduceState(previous: State, input: Action, now = Date.now()): State {
  const action = actionSchema.parse(input);
  if (action.type === 'import') return reconcile(action.value, now);
  const state = reconcile(previous, now);
  switch (action.type) {
    case 'add-delayed-view': {
      if (action.item.dueAt <= now) throw new Error('Choose a time in the future.');
      return {
        ...state,
        delayedViews: [
          ...state.delayedViews.filter((v) => v.id !== action.item.id),
          {
            ...action.item,
            createdAt: now,
            status: 'scheduled',
            openedAt: undefined,
            retryAt: undefined,
            error: undefined,
          },
        ],
      };
    }
    case 'cancel-delayed-view':
      return {
        ...state,
        delayedViews: state.delayedViews.map((v) =>
          v.id === action.id ? { ...v, status: 'cancelled', error: undefined } : v,
        ),
      };
    case 'remove-delayed-view':
      return { ...state, delayedViews: state.delayedViews.filter((v) => v.id !== action.id) };
    case 'mark-delayed-opened':
      return {
        ...state,
        delayedViews: state.delayedViews.map((v) =>
          v.id === action.id
            ? { ...v, status: 'opened', openedAt: now, error: undefined, retryAt: undefined }
            : v,
        ),
      };
    case 'reschedule-delayed-view': {
      if (action.dueAt <= now) throw new Error('Choose a time in the future.');
      return {
        ...state,
        delayedViews: state.delayedViews.map((v) =>
          v.id === action.id
            ? {
                ...v,
                dueAt: action.dueAt,
                status: 'scheduled',
                openedAt: undefined,
                retryAt: undefined,
                error: undefined,
              }
            : v,
        ),
      };
    }
    case 'save-routine': {
      const old = state.routines.find((r) => r.id === action.routine.id);
      const changedSchedule =
        old && JSON.stringify(old.schedule) !== JSON.stringify(action.routine.schedule);
      const routine = {
        ...action.routine,
        createdAt: old?.createdAt ?? now,
        startAt: !old || changedSchedule ? now : old.startAt,
      };
      return {
        ...state,
        routines: [...state.routines.filter((r) => r.id !== routine.id), routine],
        occurrences: changedSchedule
          ? state.occurrences.map((o) =>
              o.routineId === routine.id && o.status === 'pending'
                ? { ...o, status: 'skipped' }
                : o,
            )
          : state.occurrences,
      };
    }
    case 'delete-routine':
      return {
        ...state,
        routines: state.routines.filter((r) => r.id !== action.id),
        occurrences: state.occurrences.map((o) =>
          o.routineId === action.id && o.status === 'pending' ? { ...o, status: 'skipped' } : o,
        ),
      };
    case 'toggle-routine':
      return {
        ...state,
        routines: state.routines.map((r) =>
          r.id === action.id
            ? { ...r, enabled: !r.enabled, startAt: !r.enabled ? now : r.startAt }
            : r,
        ),
        occurrences: state.occurrences.map((o) =>
          o.routineId === action.id && o.status === 'pending' ? { ...o, status: 'skipped' } : o,
        ),
      };
    case 'settings':
      return { ...state, settings: action.value };
    case 'scratchpad':
      return { ...state, scratchpad: action.value };
    default: {
      let occurrences = [...state.occurrences];
      // Allow today's upcoming routine to be checked off early.
      if (!occurrences.some((o) => o.id === action.id)) {
        const planned = forDay(state, new Date(now)).find((o) => o.id === action.id);
        if (!planned) throw new Error('This reminder is no longer available.');
        occurrences.push(planned);
      }
      occurrences = occurrences.map((o) => {
        if (o.id !== action.id) return o;
        switch (action.type) {
          case 'complete':
            return { ...o, status: 'completed', completedAt: now, snoozedUntil: undefined };
          case 'skip':
            return { ...o, status: 'skipped', completedAt: undefined };
          case 'snooze':
            return {
              ...o,
              status: 'pending',
              completedAt: undefined,
              snoozedUntil: now + 10 * 60000,
            };
          case 'undo':
            return {
              ...o,
              status: now - o.scheduledAt >= 86400000 ? 'missed' : 'pending',
              completedAt: undefined,
              snoozedUntil: undefined,
            };
          case 'task':
            return {
              ...o,
              tasks: o.tasks.map((t) => (t.id === action.taskId ? { ...t, done: action.done } : t)),
            };
          case 'note':
            return { ...o, notes: action.value };
        }
      });
      return { ...state, occurrences };
    }
  }
}
