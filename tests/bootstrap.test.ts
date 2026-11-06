// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
const renderer = vi.hoisted(() => ({ createRoot: vi.fn(), render: vi.fn() }));
vi.mock('react-dom/client', () => ({ createRoot: renderer.createRoot }));
vi.mock('../src/App', () => ({ default: () => null }));
describe('application bootstrap', () => {
  it('mounts the app and keeps failed service-worker registration non-fatal', async () => {
    renderer.createRoot.mockReturnValue({ render: renderer.render });
    const root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);
    const register = vi.fn().mockRejectedValue(new Error('Offline registration'));
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register } });
    await import('../src/main');
    await Promise.resolve();
    expect(renderer.createRoot).toHaveBeenCalledWith(root);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith('/sw.js');
    root.remove();
    vi.resetModules();
    await import('../src/main');
    expect(renderer.createRoot).toHaveBeenCalledTimes(1);
  });
});
