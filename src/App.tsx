import { Reports } from './Reports';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Car,
  Fuel,
  LayoutDashboard,
  Plus,
  Route,
  ShieldCheck,
  Settings as SettingsIcon,
  Wrench,
} from 'lucide-react';
import { initialState, parseState, type State } from './domain';
import { useStore } from './useStore';
import { errorText } from './storage';
import { Empty, Heading, Modal, Shell } from './ui';
import { CarArt, Dashboard } from './Dashboard';
import { RecordForm, type FormKind } from './Forms';
import { Maintenance, Records } from './Records';
import { Settings, syncNotifications } from './Settings';
import { demoState } from './demo';
import { Warranties, WarrantyForm } from './Warranties';
import type { Warranty } from './warranty';

const items = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard /> },
  { id: 'garage', label: 'My garage', icon: <Car /> },
  { id: 'activity', label: 'Fuel & expenses', icon: <Fuel /> },
  { id: 'maintenance', label: 'Maintenance', icon: <Wrench /> },
  { id: 'warranties', label: 'Warranties', icon: <ShieldCheck /> },
  { id: 'trips', label: 'Trips & odometer', icon: <Route /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 /> },
  { id: 'settings', label: 'Settings & data', icon: <SettingsIcon /> },
];
const titles: Record<string, [string, string]> = {
  overview: ['Good to go, mile after mile.', 'A little clarity for everything you drive.'],
  garage: ['A place for every set of keys.', 'Your vehicles, their details, and the roads they’ve taken.'],
  activity: ['The details make the difference.', 'Every fill-up, repair, and expense, neatly in one place.'],
  maintenance: ['Take care. Keep going.', 'Your service calendar, at your own pace.'],
  warranties: ['Keep your coverage close.', 'Warranty terms, expiry dates and mileage limits, together.'],
  trips: ['Miles worth remembering.', 'Track journeys and keep an honest odometer history.'],
  reports: ['The bigger picture.', 'Real numbers from your records. No guesswork.'],
  settings: ['Make it your own.', 'Preferences, private backups, and a little peace of mind.'],
};
interface Confirmation {
  title: string;
  body: string;
  action: () => Promise<void>;
}
export default function App() {
  const { state, save, ready, error, setError } = useStore(initialState, parseState);
  const [page, setPage] = useState(location.hash.slice(1) || 'overview');
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState<FormKind>();
  const [warrantyForm, setWarrantyForm] = useState<{ item?: Warranty }>();
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const vehicle = state.vehicles.find((v) => v.id === selected) ?? state.vehicles[0];
  useEffect(() => {
    const change = () =>
      setPage(items.some((item) => item.id === location.hash.slice(1)) ? location.hash.slice(1) : 'overview');
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const persist = async (next: State) => {
    await save(next);
    setNotice('Saved on this device.');
  };
  useEffect(() => {
    if (!ready) return;
    const sync = () => {
      void syncNotifications(state).catch(() =>
        setNotice('Records are safe. Android could not update notifications; check permission in Settings.'),
      );
    };
    sync();
    const resume = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', resume);
    return () => document.removeEventListener('visibilitychange', resume);
  }, [ready, state]);
  const run = (next: State) => {
    void persist(next).catch((cause) => setError(errorText(cause)));
  };
  const confirm = (title: string, body: string, action: () => Promise<void>) =>
    setConfirmation({ title, body, action });
  const action =
    page === 'settings' || page === 'reports' ? undefined : (
      <button
        disabled={!ready}
        className="button primary"
        onClick={() => {
          if (page === 'warranties' && vehicle) {
            setWarrantyForm({});
            return;
          }
          setForm(
            page === 'garage' || !vehicle
              ? { type: 'vehicle' }
              : page === 'maintenance'
                ? { type: 'schedule' }
                : { type: 'entry', category: page === 'trips' ? 'trip' : 'fuel' },
          );
        }}
      >
        <Plus size={16} />
        {page === 'garage' || !vehicle
          ? 'Add vehicle'
          : page === 'maintenance'
            ? 'Add reminder'
            : page === 'warranties'
              ? 'Add warranty'
              : 'Log activity'}
      </button>
    );
  return (
    <Shell
      name="Motorfolio"
      subtitle="For the long run"
      logo={<Car size={22} />}
      items={items}
      page={page}
      theme={state.settings.theme}
      onTheme={() =>
        run({ ...state, settings: { ...state.settings, theme: state.settings.theme === 'light' ? 'dark' : 'light' } })
      }
      footer={
        <span>
          <span className="status-dot" /> Your garage stays on this device.
        </span>
      }
    >
      <Heading
        eyebrow="LESS GUESSWORK. MORE GOOD MILES."
        title={(titles[page] ?? titles.overview)[0]}
        description={(titles[page] ?? titles.overview)[1]}
        action={action}
      />
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button className="button secondary" onClick={() => location.reload()}>
            Reload & retry
          </button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice('')}>
            ×
          </button>
        </div>
      )}
      {state.demo && (
        <div className="notice">
          <span>
            <strong>Demo garage.</strong> All records shown are fictional examples.
          </span>
          <button
            className="button secondary"
            onClick={() =>
              confirm(
                'Start a fresh garage?',
                'This clears all demo records and any additions made in demo mode.',
                () => persist({ ...initialState, settings: state.settings }),
              )
            }
          >
            Start with my vehicles
          </button>
        </div>
      )}
      {!ready && !error ? (
        <Empty title="Opening your garage…" text="Reading records from this device." />
      ) : (
        <>
          {page === 'overview' && <Dashboard state={state} vehicle={vehicle} open={setForm} choose={setSelected} />}
          {page === 'garage' && (
            <div className="garage-grid">
              {state.vehicles.map((v) => (
                <section className="panel garage-card" key={v.id}>
                  {v.photo ? <img className="garage-photo" src={v.photo} alt={v.name} /> : <CarArt />}
                  <div className="row space-between">
                    <h2>{v.name}</h2>
                    <span className="tag">{v.year}</span>
                  </div>
                  <p>
                    {v.make} {v.model} {v.trim}
                  </p>
                  <div className="actions">
                    <button
                      className="button secondary"
                      onClick={() => {
                        setSelected(v.id);
                        location.hash = 'overview';
                      }}
                    >
                      View vehicle
                    </button>
                    <button className="button secondary" onClick={() => setForm({ type: 'vehicle', item: v })}>
                      Edit
                    </button>
                    <button
                      className="button danger"
                      onClick={() =>
                        confirm(
                          'Delete this vehicle?',
                          `${v.name} and all associated activities, attachments and reminders will be removed.`,
                          () =>
                            persist({
                              ...state,
                              vehicles: state.vehicles.filter((item) => item.id !== v.id),
                              entries: state.entries.filter((item) => item.vehicleId !== v.id),
                              schedules: state.schedules.filter((item) => item.vehicleId !== v.id),
                              warranties: state.warranties.filter((item) => item.vehicleId !== v.id),
                            }),
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </section>
              ))}
              {!state.vehicles.length && <Empty title="Your garage is ready" text="Add the vehicle you drive today." />}
            </div>
          )}
          {['activity', 'trips'].includes(page) && (
            <Records
              state={state}
              trip={page === 'trips'}
              open={setForm}
              remove={(entry) =>
                confirm('Delete this activity?', `${entry.title} and its attachment will be removed.`, () =>
                  persist({ ...state, entries: state.entries.filter((item) => item.id !== entry.id) }),
                )
              }
            />
          )}
          {page === 'maintenance' && (
            <Maintenance
              state={state}
              open={setForm}
              save={run}
              remove={(id) =>
                confirm('Delete this reminder?', 'This removes the reminder from your calendar.', () =>
                  persist({ ...state, schedules: state.schedules.filter((item) => item.id !== id) }),
                )
              }
            />
          )}
          {page === 'reports' && <Reports state={state} />}
          {page === 'warranties' && (
            <Warranties
              state={state}
              edit={(item) => setWarrantyForm({ item })}
              remove={(item) =>
                confirm('Delete this warranty?', `${item.title} and its attachment will be removed.`, () =>
                  persist({ ...state, warranties: state.warranties.filter((record) => record.id !== item.id) }),
                )
              }
            />
          )}
          {page === 'settings' && <Settings state={state} save={persist} confirm={confirm} />}
          {!state.vehicles.length && page === 'overview' && (
            <div className="demo-invitation">
              <span>Want to take a look around first?</span>
              <button className="text-link" onClick={() => run(demoState())}>
                Explore a clearly labeled demo garage ↗
              </button>
            </div>
          )}
        </>
      )}
      {form && (
        <RecordForm kind={form} state={state} selected={vehicle} close={() => setForm(undefined)} save={persist} />
      )}
      {confirmation && (
        <Modal title={confirmation.title} close={() => setConfirmation(undefined)}>
          <p>{confirmation.body}</p>
          <div className="actions">
            <button className="button secondary" onClick={() => setConfirmation(undefined)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void confirmation
                  .action()
                  .then(() => setConfirmation(undefined))
                  .catch((cause) => setError(errorText(cause)))
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? 'Working…' : 'Confirm change'}
            </button>
          </div>
        </Modal>
      )}
      {warrantyForm && (
        <WarrantyForm
          state={state}
          selected={vehicle}
          item={warrantyForm.item}
          close={() => setWarrantyForm(undefined)}
          save={persist}
        />
      )}
    </Shell>
  );
}
