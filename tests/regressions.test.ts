import { describe, expect, it } from 'vitest';
import { demoState } from '../src/demo';
import {
  dueStatus,
  efficiency,
  odometer,
  ownership,
  parseState,
  scheduleSchema,
  toLiters,
  validateEntry,
  type Entry,
} from '../src/domain';
import { convertVehicleUnits } from '../src/units';
import { decryptBackup, encryptBackup } from '../src/transfer';

describe('odometer correction boundaries and distance preferences', () => {
  const state = demoState();
  const vehicle = state.vehicles[0];
  const entry = (values: Partial<Entry>): Entry => ({ ...state.entries[0], ...values });
  it('resets MPG after non-fuel corrections and accepts the new odometer range', () => {
    const records = [
      entry({ id: 'a', date: '2026-01-01', odometer: 50000 }),
      entry({
        id: 'b',
        date: '2026-01-02',
        type: 'service',
        odometer: 100,
        corrected: true,
        correction: 'Cluster replaced',
      }),
      entry({ id: 'c', date: '2026-01-03', odometer: 200 }),
      entry({ id: 'd', date: '2026-01-04', odometer: 500, liters: toLiters(10, 'gal') }),
    ];
    expect(efficiency(records, vehicle).map((item) => item.mpg)).toEqual([30]);
    expect(validateEntry(records[3], records, vehicle)).toBeNull();
    expect(validateEntry(entry({ id: 'prior', date: '2026-01-01', odometer: 50010 }), records, vehicle)).toBeNull();
    expect(validateEntry(entry({ id: 'bad', date: '2026-01-05', odometer: 50 }), records, vehicle)).toMatch(
      /conflicts/,
    );
    expect(ownership(records, vehicle, 'USD').perMile).toBeNull();
  });
  it('preserves same-day correction order when another record is edited', () => {
    const records = [
      entry({ id: 'a', odometer: 50000 }),
      entry({ id: 'b', type: 'service', odometer: 100, corrected: true, correction: 'Replacement' }),
    ];
    expect(odometer(vehicle, records)).toBe(100);
    expect(validateEntry(entry({ id: 'c', odometer: 150 }), records, vehicle)).toBeNull();
    expect(efficiency([entry({ id: 'first', odometer: 100 }), entry({ id: 'last', odometer: 90 })], vehicle)).toEqual(
      [],
    );
  });
  it('supports mileage-only schedules and rejects a schedule with neither limit', () => {
    const schedule = { ...state.schedules[0], dueDate: '', dueOdometer: 1000, leadDistance: 100 };
    expect(scheduleSchema.parse(schedule)).toEqual(schedule);
    expect(dueStatus(schedule, 899)).toBe('Scheduled');
    expect(dueStatus(schedule, 900)).toBe('Due soon');
    expect(dueStatus(schedule, 1000)).toBe('Overdue');
    expect(() => scheduleSchema.parse({ ...schedule, dueOdometer: 0 })).toThrow(/Choose a due date/);
  });
  it('converts only the selected vehicle, including trip, reminder and warranty distances', async () => {
    const original = {
      ...state,
      entries: [...state.entries, entry({ id: 'trip', type: 'trip', startOdometer: 40000 })],
      warranties: [
        {
          id: 'w',
          vehicleId: vehicle.id,
          title: 'Coverage',
          provider: 'Fixture',
          reference: '',
          startsOn: '2026-01-01',
          expiresOn: null,
          expiresOdometer: 50000,
          leadDays: 14,
          leadDistance: 500,
          notes: '',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'w2',
          vehicleId: 'demo-weekender',
          title: 'Other coverage',
          provider: 'Fixture',
          reference: '',
          startsOn: '2026-01-01',
          expiresOn: null,
          expiresOdometer: 60000,
          leadDays: 14,
          leadDistance: 500,
          notes: '',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
    };
    const converted = parseState(convertVehicleUnits(original, vehicle.id, 'km'));
    expect(converted.vehicles[0].odometer).toBeCloseTo(vehicle.odometer * 1.609344);
    expect(converted.vehicles[1]).toEqual(original.vehicles[1]);
    expect(converted.entries.at(-1)?.startOdometer).toBeCloseTo(40000 * 1.609344);
    expect(converted.schedules[0].leadDistance).toBeCloseTo(500 * 1.609344);
    expect(converted.warranties[0].expiresOdometer).toBeCloseTo(50000 * 1.609344);
    expect(converted.warranties[1]).toEqual(original.warranties[1]);
    const returned = convertVehicleUnits(converted, vehicle.id, 'mi');
    expect(returned.entries[0].odometer).toBeCloseTo(original.entries[0].odometer);
    expect(convertVehicleUnits(returned, vehicle.id, 'mi')).toBe(returned);
    expect(() => convertVehicleUnits(original, 'missing', 'km')).toThrow(/missing/);
    expect(await decryptBackup(await encryptBackup(converted, 'fixture-password'), 'fixture-password')).toEqual(
      converted,
    );
  });
});
