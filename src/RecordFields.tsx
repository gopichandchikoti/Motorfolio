import { Field } from './ui';
import { entrySchema, odometer, today, type Entry, type Schedule, type State, type Vehicle } from './domain';
import { AttachmentField } from './AttachmentField';

export function VehicleFields({ item, attach }: { item?: Vehicle; attach: (file: File) => void }) {
  return (
    <>
      <Field label="Nickname" wide>
        <input autoFocus name="name" defaultValue={item?.name} placeholder="My daily driver" required maxLength={100} />
      </Field>
      <Field label="Year">
        <input name="year" type="number" min="1886" max="2100" defaultValue={item?.year ?? 2026} required />
      </Field>
      <Field label="Make">
        <input name="make" defaultValue={item?.make} placeholder="Honda" required maxLength={100} />
      </Field>
      <Field label="Model">
        <input name="model" defaultValue={item?.model} placeholder="Civic" required maxLength={100} />
      </Field>
      <Field label="Trim (optional)">
        <input name="trim" defaultValue={item?.trim} placeholder="EX" maxLength={100} />
      </Field>
      <Field label="Odometer">
        <input
          name="odometer"
          type="number"
          min="0"
          max="1000000000"
          step="any"
          defaultValue={item?.odometer ?? 0}
          required
        />
      </Field>
      <Field label="Odometer units">
        <select name="unit" defaultValue={item?.unit ?? 'mi'} disabled={Boolean(item)}>
          <option value="mi">Miles (mi)</option>
          <option value="km">Kilometers (km)</option>
        </select>
        <small>Change units in Settings to convert all vehicle history together.</small>
      </Field>
      <Field label="VIN (optional)" wide>
        <input name="vin" defaultValue={item?.vin} maxLength={17} />
        <small>Stored locally. No automatic VIN lookup or manufacturer assumptions.</small>
      </Field>
      <AttachmentField label="Vehicle photo (optional, up to 3 MB)" name="photo" imagesOnly onSelect={attach} />
    </>
  );
}

export function EntryFields({
  item,
  entryType,
  setEntryType,
  state,
  selected,
  attach,
}: {
  item?: Entry;
  entryType: Entry['type'];
  setEntryType: (value: Entry['type']) => void;
  state: State;
  selected?: Vehicle;
  attach: (file: File) => void;
}) {
  return (
    <>
      <Field label="Activity type">
        <select
          name="type"
          value={entryType}
          onChange={(event) => setEntryType(entrySchema.shape.type.parse(event.target.value))}
        >
          <option value="fuel">Fuel fill-up</option>
          <option value="service">Service & maintenance</option>
          <option value="expense">Other expense / warranty</option>
          <option value="trip">Trip / odometer</option>
        </select>
      </Field>
      <Field label="Date">
        <input type="date" name="date" defaultValue={item?.date ?? today()} max={today()} required />
      </Field>
      <Field label="Description" wide>
        <input
          name="title"
          defaultValue={item?.title}
          placeholder={entryType === 'fuel' ? 'Regular unleaded' : 'What did you take care of?'}
          required
          maxLength={200}
        />
      </Field>
      <Field label={`Odometer (${selected?.unit ?? 'vehicle units'})`}>
        <input
          name="odometer"
          key={selected?.id}
          type="number"
          min="0"
          step="any"
          defaultValue={item?.odometer ?? (selected ? odometer(selected, state.entries) : 0)}
          required
        />
      </Field>
      <Field label="Total cost">
        <input name="cost" type="number" min="0" step="0.01" defaultValue={item?.cost ?? 0} required />
      </Field>
      <Field label="Currency">
        <select name="currency" defaultValue={item?.currency ?? state.settings.currency}>
          {['USD', 'EUR', 'GBP', 'INR'].map((unit) => (
            <option key={unit}>{unit}</option>
          ))}
        </select>
      </Field>
      <Field label="Category">
        <select name="category" defaultValue={item?.category ?? (entryType === 'fuel' ? 'Fuel' : 'Custom')}>
          {[
            'Fuel',
            'Oil',
            'Tires',
            'Brakes',
            'Battery',
            'Fluids',
            'Inspection',
            'Insurance',
            'Warranty',
            'Trip',
            'Custom',
          ].map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </Field>
      {entryType === 'fuel' && (
        <>
          <Field label={`Quantity (${state.settings.volume})`}>
            <input
              name="quantity"
              type="number"
              min="0.001"
              step="0.001"
              defaultValue={item ? item.liters / (state.settings.volume === 'gal' ? 3.785411784 : 1) : undefined}
              required
            />
          </Field>
          <Field label="Tank status">
            <select name="full" defaultValue={String(item?.full ?? true)}>
              <option value="true">Full tank</option>
              <option value="false">Partial fill</option>
            </select>
          </Field>
          <p className="subtle wide">
            MPG uses complete intervals between full tanks, including intermediate partial fills. Unit price is
            calculated from total cost ÷ quantity.
          </p>
        </>
      )}
      {entryType === 'trip' && (
        <Field label="Starting odometer">
          <input name="startOdometer" type="number" min="0" step="any" defaultValue={item?.startOdometer} required />
        </Field>
      )}
      <Field label={entryType === 'fuel' ? 'Station (optional)' : 'Provider / place (optional)'} wide>
        <input name="provider" defaultValue={item?.provider} maxLength={200} />
      </Field>
      <Field label="Notes / warranty details (optional)" wide>
        <textarea name="notes" defaultValue={item?.notes} maxLength={2000} />
      </Field>
      <AttachmentField
        label="Receipt (image or PDF, up to 3 MB)"
        name="receipt"
        existingName={item?.receiptName}
        onSelect={attach}
      />
      <label className="check wide">
        <input type="checkbox" name="corrected" defaultChecked={item?.corrected} />
        This is an intentional odometer correction
      </label>
      <Field label="Correction reason (required for a correction)" wide>
        <input
          name="correction"
          defaultValue={item?.correction}
          maxLength={300}
          placeholder="For example, instrument cluster replacement"
        />
      </Field>
    </>
  );
}

export function ScheduleFields({ item }: { item?: Schedule }) {
  return (
    <>
      <Field label="Service / reminder" wide>
        <input autoFocus name="title" defaultValue={item?.title} required maxLength={200} />
      </Field>
      <Field label="Due date (optional for mileage reminders)">
        <input type="date" name="dueDate" defaultValue={item?.dueDate ?? today()} />
      </Field>
      <Field label="Due odometer (0 = date only)">
        <input type="number" min="0" step="any" name="dueOdometer" defaultValue={item?.dueOdometer ?? 0} required />
      </Field>
      <Field label="Notify days before">
        <input type="number" min="0" max="365" name="leadDays" defaultValue={item?.leadDays ?? 7} required />
      </Field>
      <Field label="Notify distance before (vehicle units)">
        <input type="number" min="0" step="any" name="leadDistance" defaultValue={item?.leadDistance ?? 250} required />
      </Field>
      <p className="subtle wide">
        Choose intervals from your owner's manual. These are your editable reminders, not manufacturer recommendations.
      </p>
    </>
  );
}
