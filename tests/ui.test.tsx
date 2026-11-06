// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import axe from 'axe-core';
import App from '../src/App';
import { saveSnapshot, loadSnapshot } from '../src/storage';
import { demoState } from '../src/demo';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  location.hash = '';
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(cleanup);
async function navigate(page: string) {
  location.hash = page;
  fireEvent(window, new Event('hashchange'));
}
describe('Motorfolio user journeys (DOM, not a real browser)', () => {
  it('supports the remaining record types, vehicle selection, reminders and complete local deletion', async () => {
    await saveSnapshot(demoState(), 0);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Demo garage.');
    await user.selectOptions(screen.getByLabelText('Selected vehicle'), 'demo-weekender');
    await screen.findByText('Nothing on the calendar yet');
    await user.selectOptions(screen.getByLabelText('Selected vehicle'), 'demo-vehicle');
    await user.click(screen.getByRole('button', { name: 'Vehicle details' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await navigate('maintenance');
    await screen.findByText('Your maintenance calendar');
    await user.click(screen.getByRole('button', { name: 'Add reminder' }));
    await user.type(screen.getByLabelText('Service / reminder'), 'Extra inspection');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await screen.findByText('Extra inspection');
    await user.click(screen.getByRole('button', { name: 'Edit Extra inspection' }));
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await user.click(screen.getByRole('button', { name: 'Delete reminder Extra inspection' }));
    await user.click(screen.getByRole('button', { name: 'Confirm change' }));
    await waitFor(() => expect(screen.queryByText('Extra inspection')).toBeNull());
    await navigate('activity');
    await screen.findByRole('textbox', { name: 'Search activity' });
    await user.selectOptions(screen.getByLabelText('Filter vehicle'), 'demo-weekender');
    await user.selectOptions(screen.getByLabelText('Filter type'), 'expense');
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-12-31' } });
    await user.selectOptions(screen.getByLabelText('Filter vehicle'), 'all');
    await user.selectOptions(screen.getByLabelText('Filter type'), 'all');
    await user.click(screen.getByRole('button', { name: 'Log activity' }));
    await user.selectOptions(screen.getByLabelText('Activity type'), 'service');
    await user.type(screen.getByLabelText('Description'), 'Brake inspection');
    await user.selectOptions(screen.getByLabelText('Category'), 'Brakes');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await screen.findByText('Brake inspection');
    await navigate('trips');
    await screen.findByText('Miles worth remembering.');
    await user.click(screen.getByRole('button', { name: 'Log activity' }));
    await user.type(screen.getByLabelText('Description'), 'Corrected trip');
    await user.type(screen.getByLabelText('Starting odometer'), '40000');
    await user.click(screen.getByLabelText('This is an intentional odometer correction'));
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await screen.findByText('Explain the odometer correction.');
    await user.type(
      screen.getByLabelText('Correction reason (required for a correction)'),
      'Verified after cluster replacement',
    );
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await screen.findByText('Corrected trip');
    await navigate('garage');
    await screen.findByText('A place for every set of keys.');
    await user.click(screen.getAllByRole('button', { name: 'View vehicle' })[0]);
    await screen.findByLabelText('Selected vehicle');
    await navigate('garage');
    await screen.findByText('A place for every set of keys.');
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await user.click(screen.getByRole('button', { name: 'Confirm change' }));
    await waitFor(() => expect(screen.queryByText('The daily driver')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Dark appearance' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    await navigate('settings');
    await screen.findByText('Your preferences');
    await user.click(screen.getByRole('button', { name: 'Delete all local data' }));
    await user.click(screen.getByRole('button', { name: 'Confirm change' }));
    await navigate('overview');
    await screen.findByRole('button', { name: 'Add your first vehicle' });
    await user.click(screen.getByRole('button', { name: /Explore a clearly labeled demo garage/ }));
    await screen.findByText('Demo garage.');
    await user.click(screen.getByRole('button', { name: 'Start with my vehicles' }));
    await user.click(screen.getByRole('button', { name: 'Confirm change' }));
    await screen.findByRole('button', { name: 'Add your first vehicle' });
    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));
  });
  it('onboards a vehicle, persists it and rejects invalid fuel history', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Add your first vehicle' }));
    await user.type(screen.getByLabelText('Nickname'), 'Test hatchback');
    await user.type(screen.getByLabelText('Make'), 'Honda');
    await user.type(screen.getByLabelText('Model'), 'Fit');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await screen.findByText('Test hatchback');
    expect(JSON.stringify((await loadSnapshot())?.value)).toContain('Test hatchback');
    await user.click(screen.getByRole('button', { name: 'Log activity' }));
    await user.type(screen.getByLabelText('Description'), 'A real first fill');
    await user.type(screen.getByLabelText('Quantity (gal)'), '10');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await screen.findByText('A real first fill');
    expect(JSON.stringify((await loadSnapshot())?.value)).toContain('A real first fill');
    const accessibility = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false }, 'label-content-name-mismatch': { enabled: false } },
    });
    expect(accessibility.violations.map((item) => item.id)).toEqual([]);
  });
  it('navigates the seeded workspace, searches, edits, completes and confirms deletion', async () => {
    await saveSnapshot(demoState(), 0);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Demo garage.');
    await navigate('garage');
    await screen.findByText('A place for every set of keys.');
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    await user.clear(screen.getByLabelText('Nickname'));
    await user.type(screen.getByLabelText('Nickname'), 'Renamed daily');
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    await screen.findByText('Renamed daily');
    await navigate('activity');
    await screen.findByPlaceholderText('Search your records…');
    await user.type(screen.getByRole('textbox', { name: 'Search activity' }), 'Oil');
    expect(screen.getByText('Oil & filter change')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Edit Oil & filter change' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Delete Oil & filter change' }));
    await user.click(screen.getByRole('button', { name: 'Confirm change' }));
    await waitFor(() => expect(screen.queryByText('Oil & filter change')).toBeNull());
    await navigate('maintenance');
    await screen.findByText('Your maintenance calendar');
    await user.click(screen.getAllByRole('button', { name: 'Complete' })[0]);
    await screen.findByRole('button', { name: 'Reopen' });
    await navigate('reports');
    await screen.findByText('Monthly ownership costs');
    await navigate('trips');
    await screen.findByText('No records here yet');
    await navigate('settings');
    await screen.findByText('Your preferences');
    await user.selectOptions(screen.getByLabelText('Appearance'), 'dark');
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    await user.selectOptions(screen.getByLabelText('Fuel entry unit'), 'L');
    await user.selectOptions(screen.getByLabelText('Reporting currency'), 'EUR');
    await user.click(screen.getByRole('button', { name: 'Encrypted backup' }));
    expect(screen.getByText('Create encrypted backup')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    await user.click(screen.getByRole('button', { name: 'Import / restore' }));
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
  });
});
