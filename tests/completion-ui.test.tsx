// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import App from '../src/App';
import { demoState } from '../src/demo';
import { loadSnapshot, saveSnapshot } from '../src/storage';
import { parseState } from '../src/domain';

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  location.hash = 'activity';
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  await saveSnapshot(demoState(), 0);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe('complete ownership workflows', () => {
  it('filters expenses by category and exports only matching records', async () => {
    const user = userEvent.setup();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:fixture') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<App />);
    await screen.findByText('Oil & filter change');
    await user.selectOptions(screen.getByLabelText('Filter category'), 'Oil');
    expect(screen.queryByText('Tire rotation & inspection')).toBeNull();
    expect(screen.getByText('1 matching records')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Export results' }));
    expect(click).toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText('Filter category'), 'Tires');
    await screen.findByText('Tire rotation & inspection');
  });
  it('creates a mileage-only reminder and uses the newly selected vehicle odometer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Oil & filter change');
    await user.click(screen.getByRole('button', { name: 'Log activity' }));
    await user.selectOptions(screen.getByLabelText('Vehicle'), 'demo-weekender');
    expect(screen.getByLabelText('Odometer (mi)').getAttribute('value')).toBe('26740');
    await user.type(screen.getByLabelText('Description'), 'Secondary vehicle fill');
    await user.type(screen.getByLabelText('Quantity (gal)'), '10');
    await user.upload(
      screen.getByLabelText('Receipt (image or PDF, up to 3 MB)'),
      new File(['fixture'], 'fuel-receipt.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await screen.findByText('Secondary vehicle fill');
    const state = parseState((await loadSnapshot())?.value);
    expect(state.entries.at(-1)?.vehicleId).toBe('demo-weekender');
    expect(state.entries.at(-1)?.receipt).toMatch(/^data:application\/pdf/);
    await user.click(screen.getByRole('link', { name: 'Maintenance' }));
    await user.click(screen.getByRole('button', { name: 'Add reminder' }));
    await user.type(screen.getByLabelText('Service / reminder'), 'Mileage only');
    fireEvent.change(screen.getByLabelText('Due date (optional for mileage reminders)'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await screen.findByText(/Choose a due date/);
    await user.clear(screen.getByLabelText('Due odometer (0 = date only)'));
    await user.type(screen.getByLabelText('Due odometer (0 = date only)'), '41000');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(async () => expect(parseState((await loadSnapshot())?.value).schedules.at(-1)?.dueDate).toBe(''));
    await screen.findByText(/Mileage reminder/);
  });
});
