import { useState, type FormEvent } from 'react';
import { Field, Modal } from './ui';
import { type Entry, type Schedule, type State, type Vehicle } from './domain';
import { errorText, readForm } from './storage';
import { EntryFields, ScheduleFields, VehicleFields } from './RecordFields';
import { buildRecord } from './recordCommands';

type FormKind =
  | { type: 'vehicle'; item?: Vehicle }
  | { type: 'entry'; item?: Entry; category?: Entry['type'] }
  | { type: 'schedule'; item?: Schedule };
export type { FormKind };
export function RecordForm({
  kind,
  state,
  selected,
  close,
  save,
}: {
  kind: FormKind;
  state: State;
  selected?: Vehicle;
  close: () => void;
  save: (next: State) => Promise<void>;
}) {
  const [vehicleId, setVehicleId] = useState(
    kind.type === 'vehicle' ? '' : (kind.item?.vehicleId ?? selected?.id ?? ''),
  );
  const activeVehicle = state.vehicles.find((vehicle) => vehicle.id === vehicleId);
  const [files, setFiles] = useState<Record<string, File>>({});
  const attach = (name: string) => (file: File) => setFiles((previous) => ({ ...previous, [name]: file }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [entryType, setEntryType] = useState(
    kind.type === 'entry' ? (kind.item?.type ?? kind.category ?? 'fuel') : 'fuel',
  );
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = readForm(event.currentTarget);
    for (const [name, file] of Object.entries(files)) form.set(name, file);
    try {
      const next = await buildRecord({ kind, state, form });
      await save(next);
      close();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`${kind.item ? 'Edit' : 'Add'} ${kind.type === 'entry' ? 'activity' : kind.type}`}
      close={close}
      submit={(event) => {
        void submit(event);
      }}
      busy={busy}
    >
      {error && (
        <div className="notice error wide" role="alert">
          {error}
        </div>
      )}
      {kind.type === 'vehicle' ? (
        <VehicleFields item={kind.item} attach={attach('photo')} />
      ) : (
        <>
          <Field label="Vehicle" wide>
            <select name="vehicleId" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} required>
              {state.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                </option>
              ))}
            </select>
          </Field>
          {kind.type === 'schedule' ? (
            <ScheduleFields item={kind.item} />
          ) : (
            <EntryFields
              item={kind.item}
              entryType={entryType}
              setEntryType={setEntryType}
              state={state}
              selected={activeVehicle}
              attach={attach('receipt')}
            />
          )}
        </>
      )}
    </Modal>
  );
}
