import { describe, expect, it } from 'vitest';
import { demoState } from '../src/demo';
import {
  dueStatus,
  efficiency,
  initialState,
  monthlyCosts,
  odometer,
  ownership,
  parseState,
  toLiters,
  toMiles,
  today,
  uid,
  validateEntry,
  type Entry,
} from '../src/domain';
const demo = demoState();
const vehicle = demo.vehicles[0];
const entry = (props: Partial<Entry> = {}): Entry => ({ ...demo.entries[0], ...props });
describe('vehicle domain', () => {
  it('validates real state and rejects orphans, duplicates and malformed records', () => {
    expect(parseState(initialState)).toEqual(initialState);
    expect(parseState(demo)).toEqual(demo);
    expect(() => parseState({ ...demo, vehicles: [] })).toThrow();
    expect(() => parseState({ ...demo, vehicles: [vehicle, vehicle] })).toThrow();
    expect(() => parseState({ ...demo, entries: [demo.entries[0], demo.entries[0]] })).toThrow();
    expect(() => parseState({ ...demo, entries: [entry({ cost: -1 })] })).toThrow();
    expect(() => parseState({ ...demo, entries: [entry({ receipt: 'javascript:alert(1)' })] })).toThrow();
  });
  it('calculates MPG across partial tanks and excludes unanchored readings', () => {
    const entries = [
      entry({ id: '0', odometer: 0, full: false }),
      entry({ id: '1', odometer: 100, full: true }),
      entry({ id: '2', odometer: 200, full: false, liters: toLiters(5, 'gal') }),
      entry({ id: '3', odometer: 400, full: true, liters: toLiters(5, 'gal') }),
    ];
    expect(efficiency(entries, vehicle)[0].mpg).toBeCloseTo(30);
    expect(efficiency([], vehicle)).toEqual([]);
    expect(efficiency(entries, { ...vehicle, id: 'other' })).toEqual([]);
  });
  it('guards zero distance, empty quantity and correction boundaries', () => {
    const start = entry({ id: 'start', odometer: 100, liters: 0 });
    expect(efficiency([start, entry({ odometer: 100 })], vehicle)).toEqual([]);
    expect(efficiency([start, entry({ odometer: 200, liters: 0 })], vehicle)).toEqual([]);
    expect(efficiency([start, entry({ odometer: 200, corrected: true })], vehicle)).toEqual([]);
    expect(efficiency([start, entry({ odometer: 200, full: false })], vehicle)).toEqual([]);
  });
  it('converts units without inventing currency conversion', () => {
    expect(toMiles(1.609344, 'km')).toBeCloseTo(1);
    expect(toMiles(10, 'mi')).toBe(10);
    expect(toLiters(10, 'L')).toBe(10);
    expect(toLiters(1, 'gal')).toBeCloseTo(3.785411784);
  });
  it('rejects future, rollback, invalid trips and unexplained corrections', () => {
    expect(validateEntry(entry({ date: '2099-01-01' }), [], vehicle)).toMatch(/future/);
    expect(validateEntry(entry({ liters: 0 }), [], vehicle)).toMatch(/greater/);
    expect(validateEntry(entry({ type: 'trip' }), [], vehicle)).toMatch(/Trip/);
    expect(validateEntry(entry({ type: 'trip', startOdometer: 99999 }), [], vehicle)).toMatch(/Trip/);
    expect(validateEntry(entry({ corrected: true }), [], vehicle)).toMatch(/Explain/);
    expect(validateEntry(entry({ corrected: true, correction: 'Replaced cluster' }), [], vehicle)).toBeNull();
    expect(validateEntry(entry({ id: 'new', odometer: 2 }), [entry()], vehicle)).toMatch(/conflicts/);
    expect(validateEntry(entry({ id: 'new', odometer: 90000, date: '2025-01-01' }), [entry()], vehicle)).toMatch(
      /conflicts/,
    );
    expect(validateEntry(entry({ odometer: 0, date: today() }), [], vehicle)).toMatch(/baseline/);
    expect(validateEntry(entry(), [], vehicle)).toBeNull();
    expect(validateEntry(entry({ type: 'trip', startOdometer: 0 }), [], vehicle)).toBeNull();
  });
  it('derives current odometer and honest ownership denominators', () => {
    expect(odometer(vehicle, [])).toBe(vehicle.odometer);
    expect(odometer(vehicle, demo.entries)).toBe(40160);
    expect(ownership([], vehicle, 'USD').perMile).toBeNull();
    expect(ownership(demo.entries, vehicle, 'EUR').total).toBe(0);
    expect(ownership(demo.entries, vehicle, 'USD').perMile).toBeGreaterThan(0);
    expect(monthlyCosts(demo.entries, 'USD').length).toBe(5);
    expect(monthlyCosts([], 'EUR')).toEqual([]);
  });
  it('uses both distance and date lead times and respects completion', () => {
    const schedule = demo.schedules[0];
    expect(dueStatus({ ...schedule, completed: true }, 0)).toBe('Completed');
    expect(dueStatus(schedule, 0, '2026-11-20')).toBe('Overdue');
    expect(dueStatus(schedule, 40500, '2026-10-01')).toBe('Overdue');
    expect(dueStatus(schedule, 0, '2026-11-03')).toBe('Due soon');
    expect(dueStatus(schedule, 40100, '2026-10-01')).toBe('Due soon');
    expect(dueStatus(schedule, 0, '2026-10-01')).toBe('Scheduled');
    expect(uid()).toMatch(/-/);
  });
});
