import { useMemo, useRef, useState } from 'react';
import {
  Bell,
  Download,
  Upload,
  ShieldCheck,
  Check,
  FileJson,
  FileSpreadsheet,
  Monitor,
  Trash2,
} from 'lucide-react';
import type { Action, State } from '../lib/model';
import type { Theme } from '../lib/theme';
import { dayKey } from '../lib/schedule';
import { download, historyCsv, parseBackup } from '../lib/export';
import { prunableCounts } from '../lib/retention';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Confirm } from './ui/dialog';
import { CustomSelect } from './ui/select';

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function Settings({
  state,
  act,
  usage,
  onPreview,
  theme,
  setTheme,
}: {
  state: State;
  act: (action: Action) => Promise<boolean>;
  usage?: { bytes: number; quotaBytes?: number };
  onPreview: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<State>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cleanupDate, setCleanupDate] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    return dayKey(date);
  });
  const [cleanupBefore, setCleanupBefore] = useState<number>();
  const cutoff = new Date(`${cleanupDate}T00:00:00`).getTime();
  const counts = useMemo(
    () =>
      Number.isFinite(cutoff) ? prunableCounts(state, cutoff) : { checkIns: 0, savedPages: 0 },
    [state, cutoff],
  );
  const confirmCounts =
    cleanupBefore === undefined
      ? { checkIns: 0, savedPages: 0 }
      : prunableCounts(state, cleanupBefore);
  const cleanupTotal = counts.checkIns + counts.savedPages;
  const usagePercent = usage?.quotaBytes
    ? Math.round((usage.bytes / usage.quotaBytes) * 100)
    : undefined;
  function downloadFullBackup() {
    download(`routinely-backup-${dayKey(Date.now())}.json`, JSON.stringify(state, null, 2));
    setMessage('Backup download started. Keep the file somewhere safe.');
  }
  async function readFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 64 * 1024 * 1024) throw new Error('Choose a backup smaller than 64 MiB.');
      setBackup(parseBackup(await file.text()));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this file.');
    }
    if (input.current) input.current.value = '';
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">JUST THE WAY YOU LIKE IT</p>
          <h1>Make yourself at home.</h1>
          <p>A few thoughtful defaults. The rest is up to you.</p>
        </div>
      </div>
      <div className="settings-layout">
        <section className="surface settings-card">
          <h2>
            <Monitor size={18} /> Appearance
          </h2>
          <div className="setting-row">
            <div>
              <label htmlFor="theme">Color mode</label>
              <p>Follow your device, or choose light or dark.</p>
            </div>
            <CustomSelect
              id="theme"
              aria-label="Color mode"
              value={theme}
              onChange={(value) => setTheme(value as Theme)}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>
        </section>
        <section className="surface settings-card">
          <h2>
            <Bell size={18} /> Gentle reminders
          </h2>
          <div className="setting-row">
            <div>
              <label htmlFor="reminders">Floating reminders</label>
              <p>Show linked reminders on their matching page when it’s time.</p>
            </div>
            <Switch
              id="reminders"
              checked={state.settings.reminders}
              onCheckedChange={(reminders) =>
                void act({ type: 'settings', value: { ...state.settings, reminders } })
              }
            />
          </div>
          <div className="setting-row">
            <div>
              <label htmlFor="focus-existing">Open or switch to the routine’s page</label>
              <p>Off by default. Turn on to bring a linked routine into view when it is due.</p>
            </div>
            <Switch
              id="focus-existing"
              checked={state.settings.focusExistingTabs}
              onCheckedChange={(focusExistingTabs) =>
                void act({ type: 'settings', value: { ...state.settings, focusExistingTabs } })
              }
            />
          </div>
          <div className="setting-row">
            <div>
              <label htmlFor="position">A place for your panel</label>
              <p>Choose the corner that feels least in the way.</p>
            </div>
            <CustomSelect
              id="position"
              aria-label="A place for your panel"
              value={state.settings.position}
              onChange={(val) =>
                void act({
                  type: 'settings',
                  value: {
                    ...state.settings,
                    position: val as State['settings']['position'],
                  },
                })
              }
              options={[
                { value: 'top-right', label: 'Top right' },
                { value: 'bottom-right', label: 'Bottom right' },
                { value: 'top-left', label: 'Top left' },
                { value: 'bottom-left', label: 'Bottom left' },
              ]}
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>See how it feels</strong>
              <p>Preview a reminder without changing your routines.</p>
            </div>
            <Button variant="outline" onClick={onPreview}>
              <Monitor />
              Preview panel
            </Button>
          </div>
          <p className="settings-footnote">
            Reminders follow {Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ')}
            . If your browser is closed, we catch up when you return. Check-ins become missed after
            24 hours. Browser settings and store pages use the toolbar popup instead.
          </p>
        </section>
        <section className="surface settings-card">
          <h2>
            <Download size={18} /> Your data, yours to keep
          </h2>
          <p className="muted">
            Take your routines, notes, and progress with you whenever you like.
          </p>
          <div className="storage-usage">
            <strong>Storage space</strong>
            {usage ? (
              <>
                <p>
                  {formatSize(usage.bytes)} used
                  {usage.quotaBytes ? ` of ${formatSize(usage.quotaBytes)}` : ' in this browser'}
                  {usagePercent !== undefined
                    ? ` (${usagePercent === 0 && usage.bytes > 0 ? '<1' : usagePercent}%)`
                    : ''}
                  .
                </p>
                {usage.quotaBytes && (
                  <div
                    className="storage-meter"
                    role="progressbar"
                    aria-label="Local storage used"
                    aria-valuemin={0}
                    aria-valuemax={usage.quotaBytes}
                    aria-valuenow={Math.min(usage.bytes, usage.quotaBytes)}
                  >
                    <span
                      style={{
                        width: `${Math.min(100, (usage.bytes / usage.quotaBytes) * 100)}%`,
                      }}
                    />
                  </div>
                )}
                {usagePercent !== undefined && usagePercent >= 70 && (
                  <p className="storage-usage-alert" role={usagePercent >= 90 ? 'alert' : 'status'}>
                    {usagePercent >= 90
                      ? 'Space is almost full. Export a backup and clear old history soon.'
                      : 'Space is getting full. Consider exporting and clearing old history.'}
                  </p>
                )}
                {!usage.quotaBytes && <p>This browser does not report a fixed storage limit.</p>}
              </>
            ) : (
              <p>Storage usage is unavailable right now.</p>
            )}
          </div>
          <div className="export-options">
            <button onClick={downloadFullBackup}>
              <FileJson />
              <strong>Full backup</strong>
              <span>Routines, saved pages, notes & history</span>
              <small>
                Download JSON <Download size={13} />
              </small>
            </button>
            <button
              onClick={() =>
                download(
                  `routinely-history-${dayKey(Date.now())}.csv`,
                  historyCsv(state),
                  'text/csv;charset=utf-8',
                )
              }
            >
              <FileSpreadsheet />
              <strong>Check-in history</strong>
              <span>Ready for your favorite spreadsheet</span>
              <small>
                Download CSV <Download size={13} />
              </small>
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>Bring back a backup</strong>
              <p>Restore a Routinely JSON export. This replaces current data.</p>
            </div>
            <input
              ref={input}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="Import Routinely backup"
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
            <Button variant="outline" onClick={() => input.current?.click()}>
              <Upload />
              Import backup
            </Button>
          </div>
          <div className="storage-cleanup">
            <h3>Clear old history</h3>
            <p>
              Choose a cutoff date. Finished check-ins and opened or cancelled saved pages due
              before that date can be removed. Your routines and pending items stay.
            </p>
            <div className="storage-cleanup-controls">
              <label htmlFor="cleanup-date">Remove history before</label>
              <input
                id="cleanup-date"
                type="date"
                value={cleanupDate}
                max={dayKey(Date.now())}
                onChange={(event) => setCleanupDate(event.target.value)}
              />
            </div>
            <p>
              {counts.checkIns} check-ins and {counts.savedPages} saved pages would be removed.
            </p>
            <Button
              variant="outline"
              disabled={!cleanupTotal || cutoff > Date.now()}
              onClick={() => {
                downloadFullBackup();
                setCleanupBefore(cutoff);
              }}
            >
              <Trash2 />
              Download backup and review cleanup
            </Button>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="success-message">
              <Check size={15} />
              {message}
            </p>
          )}
        </section>
      </div>
      <Confirm
        open={!!backup}
        onOpenChange={(open) => {
          if (!open) setBackup(undefined);
        }}
        title="Restore this backup?"
        description={`This will replace your current data with ${backup?.routines.length ?? 0} routines, ${backup?.occurrences.length ?? 0} check-ins, and ${backup?.delayedViews.length ?? 0} saved pages. Export your current data first if you want to keep it.`}
        label="Replace and restore"
        onConfirm={() => {
          if (backup)
            void act({ type: 'import', value: backup }).then((ok) => {
              if (ok) setMessage('Your backup has been restored.');
            });
          setBackup(undefined);
        }}
      />
      <Confirm
        open={cleanupBefore !== undefined}
        onOpenChange={(open) => {
          if (!open) setCleanupBefore(undefined);
        }}
        title="Delete this old history?"
        description={`The backup download was started. Check that you saved it before continuing. This will delete ${confirmCounts.checkIns} finished check-ins and ${confirmCounts.savedPages} opened or cancelled saved pages. This cannot be undone without your backup.`}
        label="Delete old history"
        onConfirm={() => {
          if (cleanupBefore !== undefined)
            void act({ type: 'prune-history', before: cleanupBefore }).then((ok) => {
              if (ok) setMessage('Old history removed. Keep your backup to restore these records.');
            });
          setCleanupBefore(undefined);
        }}
      />
    </>
  );
}
