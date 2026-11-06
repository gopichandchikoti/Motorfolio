import { entrySchema, scheduleSchema, toLiters, uid, upsert, validateEntry, vehicleSchema, type State } from './domain';
import { fileData } from './storage';
import type { FormKind } from './Forms';

export async function buildRecord({
  kind,
  state,
  form,
}: {
  kind: FormKind;
  state: State;
  form: FormData;
}): Promise<State> {
  const text = (name: string) => String(form.get(name) ?? '').trim();
  const number = (name: string) => Number(form.get(name));
  const attachment = async (name: string) => {
    const file = form.get(name);
    return file instanceof File && file.size ? fileData(file) : undefined;
  };
  if (kind.type === 'vehicle') {
    const vehicle = vehicleSchema.parse({
      id: kind.item?.id ?? uid(),
      name: text('name'),
      year: number('year'),
      make: text('make'),
      model: text('model'),
      trim: text('trim'),
      vin: text('vin'),
      odometer: number('odometer'),
      unit: kind.item?.unit ?? text('unit'),
      photo: (await attachment('photo')) ?? kind.item?.photo,
    });
    return { ...state, vehicles: [...state.vehicles.filter((item) => item.id !== vehicle.id), vehicle] };
  }
  const vehicleId = text('vehicleId');
  if (kind.type === 'schedule') {
    const schedule = scheduleSchema.parse({
      id: kind.item?.id ?? uid(),
      vehicleId,
      title: text('title'),
      dueDate: text('dueDate'),
      dueOdometer: number('dueOdometer'),
      leadDays: number('leadDays'),
      leadDistance: number('leadDistance'),
      completed: kind.item?.completed ?? false,
    });
    return { ...state, schedules: [...state.schedules.filter((item) => item.id !== schedule.id), schedule] };
  }
  const receiptFile = form.get('receipt');
  const entry = entrySchema.parse({
    id: kind.item?.id ?? uid(),
    vehicleId,
    type: text('type'),
    date: text('date'),
    odometer: number('odometer'),
    title: text('title'),
    cost: number('cost'),
    currency: text('currency'),
    liters: toLiters(number('quantity'), state.settings.volume),
    full: text('full') === 'true',
    provider: text('provider'),
    category: text('category'),
    notes: text('notes'),
    corrected: form.has('corrected'),
    correction: text('correction'),
    receipt: (await attachment('receipt')) ?? kind.item?.receipt,
    receiptName: receiptFile instanceof File && receiptFile.size ? receiptFile.name : kind.item?.receiptName,
    startOdometer: form.has('startOdometer') ? number('startOdometer') : undefined,
  });
  const vehicle = state.vehicles.find((item) => item.id === vehicleId);
  if (!vehicle) throw new Error('Please choose a vehicle.');
  const error = validateEntry(entry, state.entries, vehicle);
  if (error) throw new Error(error);
  return { ...state, entries: upsert(state.entries, entry) };
}
