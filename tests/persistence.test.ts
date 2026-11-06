import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { loadSnapshot, saveSnapshot } from '../src/storage';
import { demoState } from '../src/demo';
import { decryptBackup, encryptBackup, exportCsv, importCsv } from '../src/transfer';

describe('durable storage and backup boundaries', () => {
  it('stores a real IndexedDB transaction, survives re-open and rejects stale writes', async () => {
    expect(await loadSnapshot()).toBeNull();
    expect(await saveSnapshot(demoState(), 0)).toBe(1);
    expect((await loadSnapshot())?.value).toEqual(demoState());
    await expect(saveSnapshot({}, 0)).rejects.toThrow(/Another tab/);
    expect((await loadSnapshot())?.revision).toBe(1);
    expect(await saveSnapshot(demoState(), 1)).toBe(2);
  });
  it('roundtrips encrypted data and rejects wrong passwords or corrupted backups', async () => {
    const state = demoState();
    const encrypted = await encryptBackup(state, 'a real test password');
    expect(encrypted).not.toContain('Honda');
    expect(await decryptBackup(encrypted, 'a real test password')).toEqual(state);
    await expect(decryptBackup(encrypted, 'wrong password')).rejects.toThrow(/unlock/);
    await expect(decryptBackup('{}', 'a real test password')).rejects.toThrow(/unlock/);
    await expect(encryptBackup(state, 'short')).rejects.toThrow(/10 characters/);
  });
  it('roundtrips CSV including trip columns, safely quotes notes and rejects orphan imports', () => {
    const state = demoState();
    const trip = {
      ...state.entries[0],
      id: 'trip',
      type: 'trip' as const,
      startOdometer: 100,
      odometer: 200,
      title: 'A trip, with "quotes"',
      notes: 'line one\nline two',
    };
    const csv = exportCsv([...state.entries, trip]);
    const restored = importCsv(
      csv,
      state.vehicles.map((vehicle) => vehicle.id),
    );
    expect(restored.at(-1)?.startOdometer).toBe(100);
    expect(restored.at(-1)?.title).toBe(trip.title);
    expect(restored.at(-1)?.notes).toBe(trip.notes);
    expect(() => importCsv(csv, [])).toThrow(/vehicle/);
    expect(() => importCsv('id,title\n"bad', [])).toThrow();
    expect(exportCsv([{ ...trip, title: '=1+1' }])).toContain("'=1+1");
  });
});
