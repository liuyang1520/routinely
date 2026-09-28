import { stateSchema, type State } from './model';

export function parseBackup(text: string): State {
  if (text.length > 10 * 1024 * 1024) throw new Error('Choose a backup smaller than 10 MB.');
  const parsed = stateSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error('This file is not a valid Routinely v1 backup.');
  return parsed.data;
}
export function historyCsv(state: State): string {
  // Prevent spreadsheet formula execution when a title or note is opened in Excel.
  const cell = (value: string) =>
    `"${(/^[=+@\-\t\r\n]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  return [
    ['Routine', 'Label', 'Scheduled at', 'Status', 'Completed at', 'Notes'],
    ...state.occurrences.map((o) => [
      o.title,
      o.label,
      new Date(o.scheduledAt).toISOString(),
      o.status,
      o.completedAt ? new Date(o.completedAt).toISOString() : '',
      o.notes,
    ]),
  ]
    .map((row) => row.map(cell).join(','))
    .join('\r\n');
}
export function download(name: string, value: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
