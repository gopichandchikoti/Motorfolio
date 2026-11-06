import { z } from 'zod';
import {
  idSchema as id,
  textSchema as text,
  dateSchema as date,
  amountSchema as amount,
  attachmentSchema as attachment,
} from './contracts';
import { warrantySchema } from './warranty';
export const vehicleSchema = z.object({
  id,
  name: text,
  year: z.number().int().min(1886).max(2100),
  make: text,
  model: text,
  trim: z.string().max(100),
  vin: z.string().max(17),
  odometer: amount,
  unit: z.enum(['mi', 'km']),
  photo: attachment.optional(),
});
export const entrySchema = z.object({
  id,
  vehicleId: id,
  type: z.enum(['fuel', 'service', 'expense', 'trip']),
  date,
  odometer: amount,
  title: text,
  cost: amount,
  currency: z.enum(['USD', 'EUR', 'GBP', 'INR']),
  liters: amount,
  full: z.boolean(),
  provider: z.string().max(200),
  category: text,
  notes: z.string().max(2000),
  corrected: z.boolean(),
  correction: z.string().max(300),
  receipt: attachment.optional(),
  receiptName: z.string().max(200).optional(),
  startOdometer: amount.optional(),
});
export const scheduleSchema = z
  .object({
    id,
    vehicleId: id,
    title: text,
    dueDate: z.union([date, z.literal('')]),
    dueOdometer: amount,
    leadDays: z.number().int().min(0).max(365),
    leadDistance: amount,
    completed: z.boolean(),
  })
  .refine((item) => Boolean(item.dueDate) || item.dueOdometer > 0, {
    path: ['dueDate'],
    message: 'Choose a due date, a due odometer, or both.',
  });
export const stateSchema = z
  .object({
    version: z.literal(2),
    demo: z.boolean(),
    vehicles: z.array(vehicleSchema).max(100),
    entries: z.array(entrySchema).max(20000),
    schedules: z.array(scheduleSchema).max(2000),
    warranties: z.array(warrantySchema).max(2000),
    settings: z.object({
      theme: z.enum(['light', 'dark']),
      currency: z.enum(['USD', 'EUR', 'GBP', 'INR']),
      volume: z.enum(['gal', 'L']),
      notifications: z.boolean(),
    }),
  })
  .superRefine((value, context) => {
    const ids = new Set(value.vehicles.map((vehicle) => vehicle.id));
    if (ids.size !== value.vehicles.length)
      context.addIssue({ code: 'custom', message: 'Duplicate vehicle identifiers.' });
    for (const list of [value.entries, value.schedules, value.warranties]) {
      if (new Set(list.map((item) => item.id)).size !== list.length) {
        context.addIssue({ code: 'custom', message: 'Duplicate record identifiers.' });
      }
      if (list.some((item) => !ids.has(item.vehicleId))) {
        context.addIssue({ code: 'custom', message: 'A record refers to a missing vehicle.' });
      }
    }
  });
export type Vehicle = z.infer<typeof vehicleSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type State = z.infer<typeof stateSchema>;
export const initialState: State = {
  version: 2,
  demo: false,
  vehicles: [],
  entries: [],
  schedules: [],
  warranties: [],
  settings: { theme: 'light', currency: 'USD', volume: 'gal', notifications: false },
};
export function parseState(value: unknown): State {
  const input = z.object({ version: z.number().int() }).passthrough().parse(value);
  return stateSchema.parse(input.version === 1 ? { ...input, version: 2, warranties: input.warranties ?? [] } : input);
}
export const uid = () => crypto.randomUUID();
export const today = () => new Date().toLocaleDateString('en-CA');
export const toMiles = (distance: number, unit: Vehicle['unit']) => (unit === 'mi' ? distance : distance / 1.609344);
export const toLiters = (volume: number, unit: 'gal' | 'L') => (unit === 'gal' ? volume * 3.785411784 : volume);

export function validateEntry(entry: Entry, entries: Entry[], vehicle: Vehicle): string | null {
  if (entry.date > today()) return 'A completed activity cannot be dated in the future.';
  if (entry.type === 'fuel' && entry.liters <= 0) return 'Fuel quantity must be greater than zero.';
  if (entry.type === 'trip' && (entry.startOdometer === undefined || entry.startOdometer >= entry.odometer)) {
    return 'Trip end odometer must be greater than the starting odometer.';
  }
  if (entry.corrected) return entry.correction.trim() ? null : 'Explain the odometer correction.';
  const records = timeline(upsert(entries, entry), vehicle.id);
  const index = records.findIndex((item) => item.id === entry.id);
  const previous = records.slice(0, index);
  const lastCorrection = previous.map((item) => item.corrected).lastIndexOf(true);
  const before = previous.slice(lastCorrection < 0 ? 0 : lastCorrection);
  const following = records.slice(index + 1);
  const nextCorrection = following.findIndex((item) => item.corrected);
  const after = following.slice(0, nextCorrection < 0 ? following.length : nextCorrection);
  if (before.some((item) => item.odometer > entry.odometer) || after.some((item) => item.odometer < entry.odometer)) {
    return 'This odometer conflicts with your history. Check the value or mark a correction.';
  }
  if (!before.length && !after.length && entry.date === today() && entry.odometer < vehicle.odometer) {
    return 'The odometer is below the vehicle baseline. Mark a correction if this is intentional.';
  }
  return null;
}

export function upsert<T extends { id: string }>(records: T[], record: T): T[] {
  return records.some((item) => item.id === record.id)
    ? records.map((item) => (item.id === record.id ? record : item))
    : [...records, record];
}

function timeline(entries: Entry[], vehicleId: string): Entry[] {
  return entries.filter((entry) => entry.vehicleId === vehicleId).sort((a, b) => a.date.localeCompare(b.date));
}

export interface Efficiency {
  id: string;
  date: string;
  mpg: number;
}
export function efficiency(entries: Entry[], vehicle: Vehicle): Efficiency[] {
  const fuel = timeline(entries, vehicle.id);
  let baseline: number | null = null;
  let liters = 0;
  const result: Efficiency[] = [];
  for (const entry of fuel) {
    if (entry.corrected) {
      baseline = null;
      liters = 0;
      continue;
    }
    if (entry.type !== 'fuel') continue;
    if (baseline === null) {
      if (entry.full) baseline = entry.odometer;
      continue;
    }
    liters += entry.liters;
    if (!entry.full) continue;
    const miles = toMiles(entry.odometer - baseline, vehicle.unit);
    if (miles > 0 && liters > 0) result.push({ id: entry.id, date: entry.date, mpg: miles / (liters / 3.785411784) });
    baseline = entry.odometer;
    liters = 0;
  }
  return result;
}

export function odometer(vehicle: Vehicle, entries: Entry[]) {
  const latest = timeline(entries, vehicle.id).at(-1);
  return latest ? latest.odometer : vehicle.odometer;
}

export function dueStatus(schedule: Schedule, current: number, now = today()) {
  if (schedule.completed) return 'Completed';
  if ((schedule.dueDate && schedule.dueDate < now) || (schedule.dueOdometer > 0 && current >= schedule.dueOdometer))
    return 'Overdue';
  const days = schedule.dueDate
    ? (Date.parse(`${schedule.dueDate}T12:00:00Z`) - Date.parse(`${now}T12:00:00Z`)) / 86400000
    : Infinity;
  if (
    days <= schedule.leadDays ||
    (schedule.dueOdometer > 0 && current + schedule.leadDistance >= schedule.dueOdometer)
  ) {
    return 'Due soon';
  }
  return 'Scheduled';
}

export function monthlyCosts(entries: Entry[], currency: string) {
  const totals = new Map<string, number>();
  for (const entry of entries.filter((item) => item.currency === currency)) {
    const month = entry.date.slice(0, 7);
    totals.set(month, (totals.get(month) ?? 0) + entry.cost);
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b));
}

export function ownership(entries: Entry[], vehicle: Vehicle, currency: string) {
  const records = entries.filter((entry) => entry.vehicleId === vehicle.id);
  const total = records.filter((entry) => entry.currency === currency).reduce((sum, entry) => sum + entry.cost, 0);
  const distances = records.map((entry) => entry.odometer);
  const distance =
    distances.length > 1 && !records.some((entry) => entry.corrected)
      ? Math.max(...distances) - Math.min(...distances)
      : 0;
  return { total, distance, perMile: distance > 0 ? total / toMiles(distance, vehicle.unit) : null };
}
