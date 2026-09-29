import { z } from 'zod';

const timestamp = z.number().finite().nonnegative();
const labelSchema = z.string().trim().max(60).default('');
function migrateLegacyLabel(value: unknown) {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  return { ...record, label: record.label ?? record.category ?? '' };
}
export const scheduleSchema = z
  .object({
    frequency: z.enum(['daily', 'weekly', 'monthly', 'interval']),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    days: z.array(z.number().int().min(0).max(6)).max(7),
    monthDay: z.number().int().min(1).max(31),
    interval: z.number().int().min(1).max(365),
  })
  .refine((s) => s.frequency !== 'weekly' || s.days.length > 0, 'Choose at least one day.');
export const safeUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    try {
      return ['https:', 'http:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Use a complete http:// or https:// link.');
export const routineSchema = z.preprocess(
  migrateLegacyLabel,
  z.object({
    id: z.string().min(1).max(100),
    title: z.string().trim().min(1).max(120),
    url: safeUrl,
    label: labelSchema,
    notes: z.string().max(10000),
    schedule: scheduleSchema,
    enabled: z.boolean(),
    pausedUntil: timestamp.optional(),
    createdAt: timestamp,
    startAt: timestamp,
  }),
);
export const occurrenceSchema = z.preprocess(
  migrateLegacyLabel,
  z.object({
    id: z.string().min(1).max(200),
    routineId: z.string().min(1).max(100),
    title: z.string().max(120),
    label: labelSchema,
    url: safeUrl,
    scheduledAt: timestamp,
    status: z.enum(['pending', 'completed', 'skipped', 'missed']),
    completedAt: timestamp.optional(),
    snoozedUntil: timestamp.optional(),
    tabHandledAt: timestamp.optional(),
    notes: z.string().max(10000),
  }),
);
export const settingsSchema = z.object({
  reminders: z.boolean(),
  focusExistingTabs: z.boolean().default(false),
  position: z.enum(['top-right', 'bottom-right', 'top-left', 'bottom-left']),
});
export const delayedViewSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  url: safeUrl.refine((value) => value.length > 0, 'Add a page link.'),
  createdAt: timestamp,
  dueAt: timestamp,
  status: z.enum(['scheduled', 'opening', 'opened', 'cancelled']),
  openedAt: timestamp.optional(),
  retryAt: timestamp.optional(),
  error: z.string().max(500).optional(),
});
export const stateSchema = z
  .object({
    version: z.literal(1),
    routines: z.array(routineSchema).max(1000),
    occurrences: z.array(occurrenceSchema).max(100000),
    delayedViews: z.array(delayedViewSchema).max(10000).default([]),
    settings: settingsSchema,
    scratchpad: z.string().max(20000),
    lastTick: timestamp,
  })
  .superRefine((state, ctx) => {
    for (const values of [state.routines, state.occurrences, state.delayedViews]) {
      if (new Set(values.map((v) => v.id)).size !== values.length)
        ctx.addIssue({ code: 'custom', message: 'Duplicate identifiers in backup.' });
    }
  });
export type Routine = z.infer<typeof routineSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type Occurrence = z.infer<typeof occurrenceSchema>;
export type DelayedView = z.infer<typeof delayedViewSchema>;
export type State = z.infer<typeof stateSchema>;
export const STORAGE_KEY = 'routinely-v1';
export const emptyState = (now = Date.now()): State => ({
  version: 1,
  routines: [],
  occurrences: [],
  delayedViews: [],
  settings: { reminders: true, position: 'top-right', focusExistingTabs: false },
  scratchpad: '',
  lastTick: now,
});
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('save-routine'), routine: routineSchema }),
  z.object({ type: z.literal('delete-routine'), id: z.string() }),
  z.object({ type: z.literal('toggle-routine'), id: z.string() }),
  z.object({ type: z.literal('pause-routine'), id: z.string(), until: timestamp.optional() }),
  z.object({ type: z.literal('complete'), id: z.string() }),
  z.object({ type: z.literal('skip'), id: z.string() }),
  z.object({ type: z.literal('snooze'), id: z.string() }),
  z.object({ type: z.literal('postpone'), id: z.string(), until: timestamp }),
  z.object({ type: z.literal('undo'), id: z.string() }),
  z.object({ type: z.literal('note'), id: z.string(), value: z.string().max(10000) }),
  z.object({ type: z.literal('scratchpad'), value: z.string().max(20000) }),
  z.object({ type: z.literal('settings'), value: settingsSchema }),
  z.object({ type: z.literal('import'), value: stateSchema }),
  z.object({ type: z.literal('prune-history'), before: timestamp }),
  z.object({ type: z.literal('add-delayed-view'), item: delayedViewSchema }),
  z.object({ type: z.literal('cancel-delayed-view'), id: z.string() }),
  z.object({ type: z.literal('remove-delayed-view'), id: z.string() }),
  z.object({ type: z.literal('mark-delayed-opened'), id: z.string() }),
  z.object({ type: z.literal('reschedule-delayed-view'), id: z.string(), dueAt: timestamp }),
]);
export type Action = z.infer<typeof actionSchema>;
