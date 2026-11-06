import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Download, LockKeyhole, Upload } from 'lucide-react';
import { initialState, parseState, validateEntry, type State } from './domain';
import { Field, Modal } from './ui';
import { download, errorText } from './storage';
import { decryptBackup, encryptBackup, exportCsv, importCsv } from './transfer';
import { convertVehicleUnits } from './units';

export async function syncNotifications(state: State) {
  if (!Capacitor.isNativePlatform()) return;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications });
  if (!state.settings.notifications) return;
  const reminders = [
    ...state.schedules
      .filter((item) => !item.completed && item.dueDate)
      .map((item) => ({ title: item.title, date: item.dueDate, leadDays: item.leadDays })),
    ...state.warranties
      .filter((item) => item.expiresOn)
      .map((item) => ({ title: `Warranty: ${item.title}`, date: item.expiresOn ?? '', leadDays: item.leadDays })),
  ];
  const notifications = reminders
    .map((item, index) => {
      const at = new Date(`${item.date}T09:00:00`);
      at.setDate(at.getDate() - item.leadDays);
      return {
        id: index + 1,
        title: 'A little care, up ahead',
        body: `${item.title} is due ${item.date}.`,
        schedule: { at, allowWhileIdle: false },
      };
    })
    .filter((item) => item.schedule.at.getTime() > Date.now());
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}

export function Settings({
  state,
  save,
  confirm,
}: {
  state: State;
  save: (state: State) => Promise<void>;
  confirm: (title: string, body: string, action: () => Promise<void>) => void;
}) {
  const [backup, setBackup] = useState(false);
  const [restore, setRestore] = useState(false);
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (cause) {
      setMessage(errorText(cause));
    } finally {
      setBusy(false);
    }
  };
  const notify = async () => {
    if (Capacitor.isNativePlatform()) {
      const permission = await LocalNotifications.requestPermissions();
      if (permission.display !== 'granted')
        throw new Error('Notifications were not allowed. In-app reminders will still work.');
      const next = { ...state, settings: { ...state.settings, notifications: true } };
      await save(next);
      await syncNotifications(next);
      setMessage('Date reminders enabled. Android may delay delivery to save battery.');
    } else {
      if (!('Notification' in window))
        throw new Error('Notifications are unavailable in this browser. In-app reminders still work.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notifications were not allowed. In-app reminders still work.');
      await save({ ...state, settings: { ...state.settings, notifications: true } });
      setMessage(
        'Browser permission granted. Scheduled reminders require the Android app; use the in-app calendar on web.',
      );
    }
  };
  const importFile = async () => {
    if (!file) throw new Error('Choose a backup or CSV file first.');
    if (file.size > 50_000_000) throw new Error('Backup is too large. Maximum size is 50 MB.');
    const text = await file.text();
    if (file.name.toLowerCase().endsWith('.csv')) {
      const entries = importCsv(
        text,
        state.vehicles.map((v) => v.id),
      );
      const merged = [...state.entries.filter((e) => !entries.some((item) => item.id === e.id)), ...entries];
      for (const entry of entries) {
        const vehicle = state.vehicles.find((v) => v.id === entry.vehicleId);
        if (!vehicle) throw new Error('Vehicle is missing.');
        const error = validateEntry(entry, merged, vehicle);
        if (error) throw new Error(`${entry.title}: ${error}`);
      }
      confirm(
        'Import activity records?',
        `${entries.length} records will be added or updated by ID. CSV does not include receipt files.`,
        () => save({ ...state, entries: merged }),
      );
    } else {
      const raw = JSON.parse(text);
      const next = raw.format ? await decryptBackup(text, password) : parseState(raw);
      confirm(
        'Replace this workspace?',
        `Restore ${next.vehicles.length} vehicles and ${next.entries.length} activities. Export your current backup first.`,
        () => save(next),
      );
    }
    setRestore(false);
    setPassword('');
  };
  return (
    <>
      {message && (
        <div role="status" className="notice">
          {message}
        </div>
      )}
      <div className="settings-grid">
        <section className="panel">
          <h2>Your preferences</h2>
          <Field label="Appearance">
            <select
              value={state.settings.theme}
              onChange={(e) => {
                void run(() =>
                  save({
                    ...state,
                    settings: { ...state.settings, theme: e.target.value === 'dark' ? 'dark' : 'light' },
                  }),
                );
              }}
            >
              <option value="light">Warm daylight</option>
              <option value="dark">After hours</option>
            </select>
          </Field>
          <Field label="Reporting currency">
            <select
              value={state.settings.currency}
              onChange={(e) => {
                void run(() =>
                  save(parseState({ ...state, settings: { ...state.settings, currency: e.target.value } })),
                );
              }}
            >
              {['USD', 'EUR', 'GBP', 'INR'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <small>
              Reports include records in this currency. No exchange rates or currency conversion are assumed.
            </small>
          </Field>
          <Field label="Fuel entry unit">
            <select
              value={state.settings.volume}
              onChange={(e) => {
                void run(() =>
                  save({ ...state, settings: { ...state.settings, volume: e.target.value === 'L' ? 'L' : 'gal' } }),
                );
              }}
            >
              <option value="gal">US gallons</option>
              <option value="L">Liters</option>
            </select>
          </Field>
          {state.vehicles.map((vehicle) => (
            <Field key={vehicle.id} label={`Distance units for ${vehicle.name}`}>
              <select
                value={vehicle.unit}
                onChange={(event) => {
                  const unit = event.target.value === 'km' ? 'km' : 'mi';
                  confirm(
                    'Convert vehicle distance units?',
                    `Convert ${vehicle.name} and all its odometers, trips, reminder and warranty distances to ${unit}. Export a backup first.`,
                    () => save(convertVehicleUnits(state, vehicle.id, unit)),
                  );
                }}
              >
                <option value="mi">Miles (mi)</option>
                <option value="km">Kilometers (km)</option>
              </select>
              <small>
                Converts all recorded distances together. Costs and fuel quantities keep their original values.
              </small>
            </Field>
          ))}
        </section>
        <section className="panel">
          <h2>Reminders, on your terms</h2>
          <p>
            Notification permission is optional. Date reminders use approximate delivery on Android, without exact-alarm
            access. Mileage reminders appear in the app when you update the odometer. Nothing monitors your driving.
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => {
              void run(notify);
            }}
          >
            Enable date notifications
          </button>
          {state.settings.notifications && (
            <button
              className="button secondary"
              onClick={() => {
                void run(async () => {
                  if (Capacitor.isNativePlatform()) {
                    const pending = await LocalNotifications.getPending();
                    await LocalNotifications.cancel({ notifications: pending.notifications });
                  }
                  await save({ ...state, settings: { ...state.settings, notifications: false } });
                });
              }}
            >
              Disable notifications
            </button>
          )}
          <p>
            Denied permission? Every reminder remains available in Maintenance. Browser delivery requires an open app;
            background date scheduling is supported by the Android app.
          </p>
        </section>
        <section className="panel">
          <h2>A copy for the road</h2>
          <p>
            Encrypted backups contain your entire garage, including photos and receipts. Keep the password somewhere
            safe; there is no recovery service.
          </p>
          <div className="actions">
            <button
              className="button primary"
              onClick={() => {
                setPassword('');
                setBackup(true);
              }}
            >
              <LockKeyhole size={16} />
              Encrypted backup
            </button>
            <button
              className="button secondary"
              onClick={() => download('Motorfolio-activity.csv', exportCsv(state.entries), 'text/csv')}
            >
              <Download size={16} />
              CSV export
            </button>
          </div>
          <button
            className="button secondary"
            onClick={() => {
              setPassword('');
              setRestore(true);
            }}
          >
            <Upload size={16} />
            Import / restore
          </button>
        </section>
        <section className="panel">
          <h2>Private by design</h2>
          <p>
            No accounts, advertising, analytics or external API requests. Browser data lives in IndexedDB on this
            origin. Android data lives in app-private SQLite. Removing app data or clearing site storage deletes your
            records. Export a backup before doing either.
          </p>
          <p>
            Photos and receipts stay local. Camera/file selection only occurs after you choose an attachment. Templates
            and demo records are examples, never manufacturer guidance.
          </p>
          <button
            className="button danger"
            onClick={() =>
              confirm(
                'Delete all local records?',
                'This removes all vehicles, activities, reminders and local attachments. Export a backup first.',
                () => save(initialState),
              )
            }
          >
            Delete all local data
          </button>
        </section>
      </div>
      {backup && (
        <Modal title="Create encrypted backup" close={() => setBackup(false)}>
          <p>AES-256-GCM encryption with a fresh salt and nonce. Your password never leaves this device.</p>
          {message && <p role="alert">{message}</p>}
          <Field label="Backup password (at least 10 characters)">
            <input
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => {
              void run(async () => {
                download('Motorfolio-encrypted.backup', await encryptBackup(state, password));
                setBackup(false);
                setPassword('');
              });
            }}
          >
            Encrypt & download
          </button>
        </Modal>
      )}
      {restore && (
        <Modal title="Import your records" close={() => setRestore(false)}>
          <p>
            CSV adds or updates activity by ID. A backup restores the full garage. You will review the change before it
            is saved.
          </p>
          {message && <p role="alert">{message}</p>}
          <Field label="Backup or CSV file">
            <input type="file" accept=".csv,.json,.backup" onChange={(e) => setFile(e.target.files?.[0])} />
          </Field>
          <Field label="Password (encrypted backup only)">
            <input type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => {
              void run(importFile);
            }}
          >
            Review import
          </button>
        </Modal>
      )}
    </>
  );
}
