// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import App from '../src/App';
import { demoState } from '../src/demo';
import { loadSnapshot, saveSnapshot } from '../src/storage';
import { parseState } from '../src/domain';
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  location.hash = 'warranties';
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(cleanup);
describe('warranty ownership workflow', () => {
  it('migrates a saved v1 garage, persists terms and a receipt, filters, edits and deletes coverage', async () => {
    const legacy = { ...demoState(), version: 1 };
    Reflect.deleteProperty(legacy, 'warranties');
    await saveSnapshot(legacy, 0);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('No coverage records here yet');
    await user.click(screen.getByRole('button', { name: 'Add warranty' }));
    await user.type(screen.getByLabelText('Coverage name'), 'Battery warranty');
    await user.type(screen.getByLabelText('Provider'), 'Fixture supplier');
    await user.type(screen.getByLabelText('Policy / receipt reference (optional)'), 'QA-POLICY');
    fireEvent.change(screen.getByLabelText('Coverage starts'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Coverage ends (optional)'), { target: { value: '2025-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await screen.findByText(/Coverage cannot end/);
    fireEvent.change(screen.getByLabelText('Coverage ends (optional)'), { target: { value: '2028-01-01' } });
    await user.clear(screen.getByLabelText('Odometer limit (0 = no recorded limit)'));
    await user.type(screen.getByLabelText('Odometer limit (0 = no recorded limit)'), '50000');
    await user.type(screen.getByLabelText('Coverage terms / exclusions (optional)'), 'Keep original receipt');
    await user.upload(
      screen.getByLabelText('Warranty receipt (image or PDF, up to 3 MB)'),
      new File(['fixture'], 'receipt.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await screen.findByText('Battery warranty');
    const stored = parseState((await loadSnapshot())?.value);
    expect(stored.version).toBe(2);
    expect(stored.entries).toEqual(legacy.entries);
    expect(stored.warranties[0].receipt).toMatch(/^data:application\/pdf/);
    expect(stored.warranties[0].reference).toBe('QA-POLICY');
    await user.selectOptions(screen.getByLabelText('Filter warranty vehicle'), 'demo-weekender');
    await screen.findByText('No coverage records here yet');
    await user.selectOptions(screen.getByLabelText('Filter warranty vehicle'), 'all');
    await user.click(screen.getByRole('button', { name: 'Edit warranty Battery warranty' }));
    // End the coverage 10 days from today so the UI genuinely renders "Expiring soon";
    // the old fixed date (2026-11-10) has passed, which made the warranty "Expired".
    const expiringSoon = new Date();
    expiringSoon.setDate(expiringSoon.getDate() + 10);
    fireEvent.change(screen.getByLabelText('Coverage ends (optional)'), {
      target: { value: expiringSoon.toLocaleDateString('en-CA') },
    });
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await screen.findByText('Expiring soon');
    await user.click(screen.getByRole('button', { name: 'Delete warranty Battery warranty' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Battery warranty')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Delete warranty Battery warranty' }));
    await user.click(screen.getByRole('button', { name: 'Confirm change' }));
    await waitFor(async () => expect(parseState((await loadSnapshot())?.value).warranties).toEqual([]));
  });
});
