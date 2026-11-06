// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const camera = vi.hoisted(() => ({ native: false, takePhoto: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => camera.native },
  registerPlugin: () => ({}),
}));
vi.mock('@capacitor/camera', () => ({ Camera: camera }));
import { AttachmentField } from '../src/AttachmentField';
beforeEach(() => {
  camera.native = false;
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('receipt import, camera cancellation and denial', () => {
  it('reads imported images and rejects unsupported or oversized files without replacing the selected file', async () => {
    const selected = vi.fn();
    render(<AttachmentField label="Receipt" name="receipt" onSelect={selected} />);
    const user = userEvent.setup({ applyAccept: false });
    const input = screen.getByLabelText('Receipt');
    await user.upload(input, new File(['fixture'], 'receipt.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(selected).toHaveBeenCalledOnce());
    await user.upload(input, new File(['bad'], 'bad.html', { type: 'text/html' }));
    await screen.findByRole('alert');
    expect(selected).toHaveBeenCalledOnce();
    await user.upload(input, new File([new Uint8Array(3_000_001)], 'large.jpg', { type: 'image/jpeg' }));
    await screen.findByText(/smaller than 3 MB/);
    expect(selected).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Capture receipt photo' }));
    const capture = screen.getByLabelText('Camera file for receipt');
    fireEvent.change(capture, { target: { files: [] } });
    fireEvent.change(capture, { target: { files: [new File(['image'], 'capture.png', { type: 'image/png' })] } });
    await waitFor(() => expect(selected).toHaveBeenCalledTimes(2));
  });
  it('captures a native photo and keeps file import available after camera errors', async () => {
    camera.native = true;
    const selected = vi.fn();
    const user = userEvent.setup();
    camera.takePhoto.mockResolvedValue({ webPath: 'https://localhost/_capacitor_file_/fixture.jpg' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['fixture'], { type: 'image/jpeg' }) }),
    );
    render(<AttachmentField label="Photo" name="photo" imagesOnly existingName="old.jpg" onSelect={selected} />);
    const button = screen.getByRole('button', { name: 'Capture vehicle photo' });
    await user.click(button);
    await waitFor(() => expect(selected).toHaveBeenCalledOnce());
    expect(camera.takePhoto).toHaveBeenCalledWith(expect.objectContaining({ saveToGallery: false }));
    expect(selected.mock.calls[0][0].type).toBe('image/jpeg');
    camera.takePhoto.mockResolvedValue({});
    await user.click(button);
    await screen.findByText(/Camera returned no photo/);
    camera.takePhoto.mockResolvedValue({ webPath: '/unreadable' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await user.click(button);
    await screen.findByText(/captured photo could not be read/);
    camera.takePhoto.mockRejectedValue(new Error('Camera permission denied'));
    await user.click(button);
    await screen.findByText(/Camera permission denied/);
    expect(selected).toHaveBeenCalledOnce();
  });
});
