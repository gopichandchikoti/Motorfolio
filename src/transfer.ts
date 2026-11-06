import Papa from 'papaparse';
import { entrySchema, parseState, type Entry, type State } from './domain';

const encode = (bytes: Uint8Array) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
const decode = (text: string) => Uint8Array.from(atob(text), (character) => character.charCodeAt(0));
async function key(password: string, salt: Uint8Array<ArrayBuffer>) {
  if (password.length < 10) throw new Error('Use a password with at least 10 characters.');
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
export async function encryptBackup(state: State, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await key(password, salt),
    new TextEncoder().encode(JSON.stringify(state)),
  );
  return JSON.stringify({
    format: 'motorfolio-aes256-v1',
    salt: encode(salt),
    iv: encode(iv),
    data: encode(new Uint8Array(encrypted)),
  });
}
export async function decryptBackup(text: string, password: string) {
  try {
    const source = JSON.parse(text);
    if (source.format !== 'motorfolio-aes256-v1') throw new Error('Unrecognized backup');
    const clear = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decode(source.iv) },
      await key(password, decode(source.salt)),
      decode(source.data),
    );
    return parseState(JSON.parse(new TextDecoder().decode(clear)));
  } catch {
    throw new Error('Could not unlock this backup. Check the password and file.');
  }
}
export function exportCsv(entries: Entry[]) {
  return Papa.unparse(
    entries.map((entry) => {
      const copy = { ...entry, startOdometer: entry.startOdometer, receiptName: entry.receiptName };
      delete copy.receipt;
      return copy;
    }),
    { escapeFormulae: true },
  );
}
export function importCsv(text: string, vehicleIds: string[]): Entry[] {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error('CSV could not be read. Export a CSV first to see the required columns.');
  return parsed.data.map((row) => {
    const entry = entrySchema.parse({
      ...row,
      odometer: Number(row.odometer),
      cost: Number(row.cost),
      liters: Number(row.liters),
      full: row.full === 'true',
      corrected: row.corrected === 'true',
      startOdometer: row.startOdometer ? Number(row.startOdometer) : undefined,
    });
    if (!vehicleIds.includes(entry.vehicleId))
      throw new Error('Import the matching vehicle before its activity records.');
    return entry;
  });
}
