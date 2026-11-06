import { useState, type FormEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { odometer, today, uid, type State, type Vehicle } from './domain';
import { warrantySchema, warrantyStatus, type Warranty } from './warranty';
import { downloadAttachment, errorText, fileData, readForm } from './storage';
import { Empty, Field, Modal, SectionTitle } from './ui';
import { AttachmentField } from './AttachmentField';

export function Warranties({
  state,
  edit,
  remove,
}: {
  state: State;
  edit: (item: Warranty) => void;
  remove: (item: Warranty) => void;
}) {
  const [vehicleId, setVehicleId] = useState('all');
  const records = state.warranties
    .filter((item) => vehicleId === 'all' || item.vehicleId === vehicleId)
    .sort((a, b) => (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999'));
  return (
    <section className="panel">
      <SectionTitle
        title="Coverage worth keeping"
        detail="Your recorded terms. Date or mileage, whichever ends first."
      />
      <div className="toolbar">
        <select aria-label="Filter warranty vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
          <option value="all">All vehicles</option>
          {state.vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      {records.length ? (
        <div className="maintenance-list">
          {records.map((item) => {
            const vehicle = state.vehicles.find((v) => v.id === item.vehicleId);
            const status = warrantyStatus(item, vehicle ? odometer(vehicle, state.entries) : 0, today());
            return (
              <article className="maintenance-row" key={item.id}>
                <div>
                  <span className={`tag ${['Expired', 'Expiring soon'].includes(status) ? 'warning' : ''}`}>
                    {status}
                  </span>
                  <h3>{item.title}</h3>
                  <p>
                    {vehicle?.name} · {item.provider}
                  </p>
                  <p>
                    From {item.startsOn}
                    {item.expiresOn ? ` · ends ${item.expiresOn}` : ''}
                    {item.expiresOdometer ? ` · limit ${item.expiresOdometer.toLocaleString()} ${vehicle?.unit}` : ''}
                  </p>
                  {item.reference && <small>Reference: {item.reference}</small>}
                  {item.notes && <p>{item.notes}</p>}
                  {item.receipt && (
                    <button
                      className="text-link receipt-link"
                      onClick={() => downloadAttachment(item.receiptName ?? 'warranty-receipt', item.receipt ?? '')}
                    >
                      Download warranty receipt
                    </button>
                  )}
                </div>
                <div className="actions">
                  <button className="icon-button" aria-label={`Edit warranty ${item.title}`} onClick={() => edit(item)}>
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`Delete warranty ${item.title}`}
                    onClick={() => remove(item)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="No coverage records here yet"
          text="Add a warranty for a vehicle, part or service. Keep the provider, limits and receipt together."
        />
      )}
      <p className="subtle">
        These are your records, not a guarantee of coverage. Check the actual provider’s terms. No expiry is assumed
        when you leave a limit blank.
      </p>
    </section>
  );
}

export function WarrantyForm({
  state,
  item,
  selected,
  close,
  save,
}: {
  state: State;
  item?: Warranty;
  selected?: Vehicle;
  close: () => void;
  save: (next: State) => Promise<void>;
}) {
  const [selectedReceipt, setSelectedReceipt] = useState<File>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = readForm(event.currentTarget);
    if (selectedReceipt) form.set('receipt', selectedReceipt);
    const text = (key: string) => String(form.get(key) ?? '').trim();
    const receipt = form.get('receipt');
    try {
      const next = warrantySchema.parse({
        id: item?.id ?? uid(),
        vehicleId: text('vehicleId'),
        title: text('title'),
        provider: text('provider'),
        reference: text('reference'),
        startsOn: text('startsOn'),
        expiresOn: text('expiresOn') || null,
        expiresOdometer: Number(form.get('expiresOdometer')),
        leadDays: Number(form.get('leadDays')),
        leadDistance: Number(form.get('leadDistance')),
        notes: text('notes'),
        receipt: receipt instanceof File && receipt.size ? await fileData(receipt) : item?.receipt,
        receiptName: receipt instanceof File && receipt.size ? receipt.name : item?.receiptName,
        createdAt: item?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await save({ ...state, warranties: [...state.warranties.filter((record) => record.id !== next.id), next] });
      close();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={item ? 'Edit warranty' : 'Add warranty'}
      close={close}
      submit={(e) => {
        void submit(e);
      }}
      busy={busy}
    >
      {error && (
        <div className="notice error wide" role="alert">
          {error}
        </div>
      )}
      <Field label="Vehicle" wide>
        <select name="vehicleId" defaultValue={item?.vehicleId ?? selected?.id} required>
          {state.vehicles.map((v) => (
            <option value={v.id} key={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Coverage name" wide>
        <input
          autoFocus
          name="title"
          required
          maxLength={200}
          defaultValue={item?.title}
          placeholder="Battery replacement coverage"
        />
      </Field>
      <Field label="Provider">
        <input name="provider" required maxLength={200} defaultValue={item?.provider} />
      </Field>
      <Field label="Policy / receipt reference (optional)">
        <input name="reference" maxLength={200} defaultValue={item?.reference} />
      </Field>
      <Field label="Coverage starts">
        <input name="startsOn" type="date" required defaultValue={item?.startsOn ?? today()} />
      </Field>
      <Field label="Coverage ends (optional)">
        <input name="expiresOn" type="date" defaultValue={item?.expiresOn ?? ''} />
      </Field>
      <Field label="Odometer limit (0 = no recorded limit)">
        <input
          name="expiresOdometer"
          type="number"
          min="0"
          step="any"
          defaultValue={item?.expiresOdometer ?? 0}
          required
        />
      </Field>
      <Field label="Remind days before expiry">
        <input name="leadDays" type="number" min="0" max="365" defaultValue={item?.leadDays ?? 14} required />
      </Field>
      <Field label="Remind distance before expiry">
        <input name="leadDistance" type="number" min="0" step="any" defaultValue={item?.leadDistance ?? 500} required />
      </Field>
      <Field label="Coverage terms / exclusions (optional)" wide>
        <textarea name="notes" maxLength={2000} defaultValue={item?.notes} />
      </Field>
      <AttachmentField
        label="Warranty receipt (image or PDF, up to 3 MB)"
        name="receipt"
        existingName={item?.receiptName}
        onSelect={setSelectedReceipt}
      />
      <p className="subtle wide">
        Distance uses the selected vehicle’s odometer unit. Date reminders require enabled Android notifications;
        mileage warnings appear after manual odometer updates.
      </p>
    </Modal>
  );
}
