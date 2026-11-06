import { describe, expect, it } from 'vitest';
import { initialState, parseState } from '../src/domain';
import { warrantySchema, warrantyStatus, type Warranty } from '../src/warranty';
import { demoState } from '../src/demo';
const item: Warranty = {
  id: 'warranty-test',
  vehicleId: 'demo-vehicle',
  title: 'Battery coverage',
  provider: 'Local supplier',
  reference: 'TEST-ONLY',
  startsOn: '2026-01-01',
  expiresOn: '2028-01-01',
  expiresOdometer: 50000,
  leadDays: 14,
  leadDistance: 500,
  notes: 'Test fixture',
  createdAt: '2026-11-05T00:00:00Z',
  updatedAt: '2026-11-05T00:00:00Z',
};
describe('coverage terms and legacy state migration', () => {
  it('migrates v1 without discarding vehicles, history, preferences or attachments', () => {
    const legacy = { ...demoState(), version: 1 };
    Reflect.deleteProperty(legacy, 'warranties');
    const migrated = parseState(legacy);
    expect(migrated.version).toBe(2);
    expect(migrated.warranties).toEqual([]);
    expect(migrated.entries).toEqual(legacy.entries);
    expect(migrated.vehicles).toEqual(legacy.vehicles);
    expect(parseState(initialState)).toEqual(initialState);
    expect(() => parseState({ ...legacy, version: 3 })).toThrow();
    expect(parseState({ ...legacy, warranties: [item] }).warranties).toEqual([item]);
  });
  it('validates terms, references and stable warranty identifiers', () => {
    expect(warrantySchema.parse(item)).toEqual(item);
    expect(() => warrantySchema.parse({ ...item, expiresOn: '2025-01-01' })).toThrow(/cannot end/);
    expect(() => warrantySchema.parse({ ...item, expiresOdometer: -1 })).toThrow();
    expect(() => parseState({ ...demoState(), warranties: [{ ...item, vehicleId: 'missing' }] })).toThrow(
      /missing vehicle/,
    );
    expect(() => parseState({ ...demoState(), warranties: [item, item] })).toThrow(/Duplicate/);
  });
  it('uses actual date and odometer limits, including unknown and not-yet-active coverage', () => {
    expect(warrantyStatus(item, 100, '2025-12-01')).toBe('Not started');
    expect(warrantyStatus(item, 100, '2028-01-02')).toBe('Expired');
    expect(warrantyStatus(item, 50000, '2027-01-01')).toBe('Expired');
    expect(warrantyStatus(item, 100, '2027-12-25')).toBe('Expiring soon');
    expect(warrantyStatus(item, 49700, '2027-01-01')).toBe('Expiring soon');
    expect(warrantyStatus(item, 100, '2027-01-01')).toBe('Active');
    expect(warrantyStatus({ ...item, expiresOn: null, expiresOdometer: 0 }, 100, '2027-01-01')).toBe(
      'No expiry recorded',
    );
    expect(warrantyStatus({ ...item, expiresOn: null }, 100, '2027-01-01')).toBe('Active');
  });
});
