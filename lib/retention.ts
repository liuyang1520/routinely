import type { DelayedView, Occurrence, State } from './model';

function isPrunableCheckIn(item: Occurrence, before: number) {
  return item.status !== 'pending' && item.scheduledAt < before;
}

function isPrunableSavedPage(item: DelayedView, before: number) {
  return (item.status === 'opened' || item.status === 'cancelled') && item.dueAt < before;
}

export function prunableCounts(state: State, before: number) {
  return {
    checkIns: state.occurrences.filter((item) => isPrunableCheckIn(item, before)).length,
    savedPages: state.delayedViews.filter((item) => isPrunableSavedPage(item, before)).length,
  };
}

export function pruneHistory(state: State, before: number): State {
  return {
    ...state,
    occurrences: state.occurrences.filter((item) => !isPrunableCheckIn(item, before)),
    delayedViews: state.delayedViews.filter((item) => !isPrunableSavedPage(item, before)),
  };
}
