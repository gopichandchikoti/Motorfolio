// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
const bridge = vi.hoisted(() => ({ native: false, load: vi.fn(), save: vi.fn(), exportFile: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => bridge.native },
  registerPlugin: () => bridge,
}));
import { download, downloadAttachment, errorText, fileData, loadSnapshot, saveSnapshot } from '../src/storage';
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  bridge.native = false;
  vi.clearAllMocks();
  bridge.load.mockResolvedValue({ json: null });
  bridge.save.mockResolvedValue(undefined);
  bridge.exportFile.mockResolvedValue(undefined);
});
describe('storage device and file boundaries', () => {
  it('uses the native SQLite bridge without a browser fallback and propagates rejection', async () => {
    bridge.native = true;
    expect(await loadSnapshot()).toBeNull();
    bridge.load.mockResolvedValue({ json: JSON.stringify({ revision: 2, value: { version: 1 } }) });
    expect(await loadSnapshot()).toEqual({ revision: 2, value: { version: 1 } });
    expect(await saveSnapshot({ version: 1 }, 2)).toBe(3);
    expect(bridge.save).toHaveBeenCalledWith({
      json: JSON.stringify({ revision: 3, value: { version: 1 } }),
      expected: 2,
    });
    bridge.save.mockRejectedValue(new Error('Storage full'));
    await expect(saveSnapshot({}, 3)).rejects.toThrow('Storage full');
    bridge.load.mockResolvedValue({ json: 'invalid' });
    await expect(loadSnapshot()).rejects.toThrow();
  });
  it('opens transactional browser storage and rejects a stale writer', async () => {
    expect(await loadSnapshot()).toBeNull();
    await saveSnapshot({ actual: 'record' }, 0);
    expect((await loadSnapshot())?.value).toEqual({ actual: 'record' });
    await expect(saveSnapshot({ lost: 'write' }, 0)).rejects.toThrow(/Another tab/);
    expect((await loadSnapshot())?.revision).toBe(1);
  });
  it('validates attachments before reading and reports a file read failure', async () => {
    await expect(fileData(new File(['bad'], 'bad.html', { type: 'text/html' }))).rejects.toThrow(/PNG/);
    await expect(fileData(new File([new Uint8Array(3_000_001)], 'huge.png', { type: 'image/png' }))).rejects.toThrow(
      /3 MB/,
    );
    expect(await fileData(new File(['photo'], 'photo.png', { type: 'image/png' }))).toMatch(/^data:image\/png;base64,/);
    const reader = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      this.dispatchEvent(new Event('error'));
    });
    await expect(fileData(new File(['photo'], 'photo.png', { type: 'image/png' }))).rejects.toThrow(
      /could not be read/,
    );
    reader.mockRestore();
  });
  it('downloads typed files on web and shares files through the native provider', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    download('records.json', '{}');
    download('records.csv', 'a,b', 'text/csv');
    downloadAttachment('receipt.png', 'data:image/png;base64,YQ==');
    expect(click).toHaveBeenCalledTimes(3);
    click.mockRestore();
    bridge.native = true;
    download('records.txt', 'content', 'text/plain');
    downloadAttachment('receipt.pdf', 'data:application/pdf;base64,YQ==');
    expect(bridge.exportFile).toHaveBeenCalledWith({
      name: 'receipt.pdf',
      type: 'application/pdf',
      content: 'YQ==',
      base64: true,
    });
    const failure = vi.fn();
    window.addEventListener('export-error', failure);
    bridge.exportFile.mockRejectedValue(new Error('No share target'));
    download('x', 'x');
    downloadAttachment('x', 'data:image/png;base64,YQ==');
    await vi.waitFor(() => expect(failure).toHaveBeenCalledTimes(2));
    window.removeEventListener('export-error', failure);
    expect(errorText(new Error('Known error'))).toBe('Known error');
    expect(errorText(null)).toMatch(/try again/);
  });
});
