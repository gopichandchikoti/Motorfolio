// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const device = vi.hoisted(() => ({
  native: false,
  permission: 'granted',
  requestPermissions: vi.fn(),
  checkPermissions: vi.fn(),
  getPending: vi.fn(),
  cancel: vi.fn(),
  schedule: vi.fn(),
  download: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => device.native },
  registerPlugin: () => ({}),
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: device }));
vi.mock('../src/storage', () => ({
  download: device.download,
  errorText: (error: unknown) => (error instanceof Error ? error.message : 'Error'),
}));
vi.mock('../src/transfer', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/transfer')>();
  return {
    ...original,
    encryptBackup: vi.fn(async (_state: unknown, password: string) => {
      if (password.length < 10) throw new Error('Password must have 10 characters');
      return 'encrypted-test-envelope';
    }),
    decryptBackup: vi.fn(async () => demoState()),
  };
});
import { Settings, syncNotifications } from '../src/Settings';
import { demoState } from '../src/demo';
import { initialState, type State } from '../src/domain';
import { exportCsv } from '../src/transfer';
const saved = vi.fn();
const confirmed: { title: string; body: string; action: () => Promise<void> }[] = [];
function Harness() {
  const [state, setState] = useState(demoState());
  return (
    <Settings
      state={state}
      save={async (next) => {
        saved(next);
        setState(next);
      }}
      confirm={(title, body, action) => confirmed.push({ title, body, action })}
    />
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  confirmed.length = 0;
  device.native = false;
  device.requestPermissions.mockResolvedValue({ display: 'granted' });
  device.checkPermissions.mockResolvedValue({ display: 'granted' });
  device.getPending.mockResolvedValue({ notifications: [{ id: 1 }] });
  device.cancel.mockResolvedValue(undefined);
  device.schedule.mockResolvedValue(undefined);
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('settings, permissions and reviewable imports', () => {
  it('converts complete distance histories only after review and cancels disabled native reminders', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const selector = screen.getByLabelText('Distance units for The daily driver');
    await user.selectOptions(selector, 'km');
    expect(saved).not.toHaveBeenCalled();
    expect(confirmed[0].title).toBe('Convert vehicle distance units?');
    await confirmed[0].action();
    await waitFor(() => expect(saved.mock.calls.at(-1)?.[0].vehicles[0].unit).toBe('km'));
    await user.selectOptions(selector, 'mi');
    await confirmed[1].action();
    await waitFor(() => expect(saved.mock.calls.at(-1)?.[0].vehicles[0].unit).toBe('mi'));
    device.native = true;
    await syncNotifications(initialState);
    expect(device.cancel).toHaveBeenCalled();
    expect(device.schedule).not.toHaveBeenCalled();
    const state = {
      ...demoState(),
      settings: { ...initialState.settings, notifications: true },
      warranties: [
        {
          id: 'w',
          vehicleId: 'demo-vehicle',
          title: 'Fixture warranty',
          provider: 'Supplier',
          reference: '',
          startsOn: '2026-01-01',
          expiresOn: '2099-01-01',
          expiresOdometer: 0,
          leadDays: 14,
          leadDistance: 0,
          notes: '',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
    };
    await syncNotifications(state);
    expect(device.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        notifications: expect.arrayContaining([
          expect.objectContaining({ body: 'Warranty: Fixture warranty is due 2099-01-01.' }),
        ]),
      }),
    );
  });
  it('handles native notification permission, scheduling, cancellation and denial', async () => {
    device.native = true;
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Enable date notifications' }));
    await screen.findByRole('button', { name: 'Disable notifications' });
    expect(device.requestPermissions).toHaveBeenCalled();
    expect(device.schedule).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Disable notifications' }));
    await waitFor(() => expect(saved.mock.calls.at(-1)?.[0].settings.notifications).toBe(false));
    device.requestPermissions.mockResolvedValue({ display: 'denied' });
    await user.click(screen.getByRole('button', { name: 'Enable date notifications' }));
    await screen.findByText(/Notifications were not allowed/);
  });
  it('remains useful without web notifications and explains web background limits', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    vi.stubGlobal('Notification', undefined);
    Reflect.deleteProperty(window, 'Notification');
    await user.click(screen.getByRole('button', { name: 'Enable date notifications' }));
    await screen.findByText(/unavailable in this browser/);
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied') });
    await user.click(screen.getByRole('button', { name: 'Enable date notifications' }));
    await screen.findByText(/Notifications were not allowed/);
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') });
    await user.click(screen.getByRole('button', { name: 'Enable date notifications' }));
    await screen.findByText(/Browser permission granted/);
  });
  it('downloads an encrypted backup and CSV, and shows backup errors inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'CSV export' }));
    expect(device.download).toHaveBeenCalledWith('Motorfolio-activity.csv', expect.any(String), 'text/csv');
    await user.click(screen.getByRole('button', { name: 'Encrypted backup' }));
    await user.type(screen.getByLabelText('Backup password (at least 10 characters)'), 'short');
    await user.click(screen.getByRole('button', { name: 'Encrypt & download' }));
    await screen.findAllByText(/Password must have 10/);
    await user.clear(screen.getByLabelText('Backup password (at least 10 characters)'));
    await user.type(screen.getByLabelText('Backup password (at least 10 characters)'), 'long enough password');
    await user.click(screen.getByRole('button', { name: 'Encrypt & download' }));
    await waitFor(() =>
      expect(device.download).toHaveBeenCalledWith('Motorfolio-encrypted.backup', 'encrypted-test-envelope'),
    );
  });
  it('requires review before a full backup replaces the workspace', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Import / restore' }));
    await user.click(screen.getByRole('button', { name: 'Review import' }));
    await screen.findAllByText(/Choose a backup/);
    const file = new File([JSON.stringify(demoState())], 'garage.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(demoState()) });
    await user.upload(screen.getByLabelText('Backup or CSV file'), file);
    await user.click(screen.getByRole('button', { name: 'Review import' }));
    await waitFor(() => expect(confirmed).toHaveLength(1));
    expect(saved).not.toHaveBeenCalled();
    expect(confirmed[0].title).toBe('Replace this workspace?');
    await confirmed[0].action();
    expect(saved).toHaveBeenCalled();
  });
  it('merges CSV by ID only after validation/review and supports encrypted restore', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Import / restore' }));
    const csv = exportCsv(demoState().entries);
    const file = new File([csv], 'activity.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: async () => csv });
    await user.upload(screen.getByLabelText('Backup or CSV file'), file);
    await user.click(screen.getByRole('button', { name: 'Review import' }));
    await waitFor(() => expect(confirmed).toHaveLength(1));
    expect(confirmed[0].title).toBe('Import activity records?');
    await confirmed[0].action();
    await user.click(screen.getByRole('button', { name: 'Import / restore' }));
    const backup = new File(['{"format":"encrypted"}'], 'garage.backup');
    Object.defineProperty(backup, 'text', { value: async () => '{"format":"encrypted"}' });
    await user.upload(screen.getByLabelText('Backup or CSV file'), backup);
    await user.click(screen.getByRole('button', { name: 'Review import' }));
    await waitFor(() => expect(confirmed).toHaveLength(2));
  });
  it('keeps delete-all reviewable and schedules only when supported and authorized', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Delete all local data' }));
    expect(saved).not.toHaveBeenCalled();
    await confirmed[0].action();
    expect(saved).toHaveBeenCalledWith(initialState);
    const state: State = { ...demoState(), settings: { ...initialState.settings, notifications: true } };
    await syncNotifications(initialState);
    expect(device.checkPermissions).not.toHaveBeenCalled();
    await syncNotifications(state);
    expect(device.checkPermissions).not.toHaveBeenCalled();
    device.native = true;
    device.checkPermissions.mockResolvedValue({ display: 'denied' });
    await syncNotifications(state);
    expect(device.getPending).not.toHaveBeenCalled();
    device.checkPermissions.mockResolvedValue({ display: 'granted' });
    device.getPending.mockResolvedValue({ notifications: [] });
    await syncNotifications({ ...state, schedules: [] });
    expect(device.schedule).not.toHaveBeenCalled();
    await syncNotifications(state);
    expect(device.schedule).toHaveBeenCalled();
  });
});
