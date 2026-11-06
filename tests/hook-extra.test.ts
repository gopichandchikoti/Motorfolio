// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const disk = vi.hoisted(() => ({ loadSnapshot: vi.fn(), saveSnapshot: vi.fn() }));
vi.mock('../src/storage', () => ({
  ...disk,
  errorText: (error: unknown) => (error instanceof Error ? error.message : 'Unexpected error'),
}));
import { useStore } from '../src/useStore';
const parse = (value: unknown) => {
  if (typeof value !== 'string') throw new Error('Corrupt stored record');
  return value;
};
beforeEach(() => {
  vi.clearAllMocks();
  disk.loadSnapshot.mockResolvedValue(null);
  disk.saveSnapshot.mockResolvedValue(1);
});
describe('state ownership and failure recovery', () => {
  it('rejects pre-readiness and overlapping saves without losing the last durable state', async () => {
    let loaded: (value: null) => void = () => undefined;
    disk.loadSnapshot.mockImplementation(
      () =>
        new Promise((resolve) => {
          loaded = resolve;
        }),
    );
    const hook = renderHook(() => useStore('initial', parse));
    await expect(hook.result.current.save('early')).rejects.toThrow(/not ready/);
    await act(async () => {
      loaded(null);
    });
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    let saved: (value: number) => void = () => undefined;
    disk.saveSnapshot.mockImplementation(
      () =>
        new Promise((resolve) => {
          saved = resolve;
        }),
    );
    let writing: Promise<void> = Promise.resolve();
    act(() => {
      writing = hook.result.current.save('later');
    });
    await expect(hook.result.current.save('overlap')).rejects.toThrow(/in progress/);
    expect(hook.result.current.state).toBe('initial');
    await act(async () => {
      saved(1);
      await writing;
    });
    expect(hook.result.current.state).toBe('later');
    disk.saveSnapshot.mockRejectedValue(new Error('Quota exceeded'));
    await expect(hook.result.current.save('failed')).rejects.toThrow('Quota exceeded');
    expect(hook.result.current.state).toBe('later');
  });
  it('loads revisions and exposes corrupt/read errors without replacing saved data', async () => {
    disk.loadSnapshot.mockResolvedValue({ revision: 8, value: 'stored' });
    const hook = renderHook(() => useStore('initial', parse));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    await act(async () => {
      await hook.result.current.save('next');
    });
    expect(disk.saveSnapshot).toHaveBeenCalledWith('next', 8);
    hook.unmount();
    disk.loadSnapshot.mockResolvedValue({ revision: 1, value: 12 });
    const bad = renderHook(() => useStore('initial', parse));
    await waitFor(() => expect(bad.result.current.error).toMatch(/Corrupt/));
    expect(bad.result.current.ready).toBe(false);
    bad.unmount();
    disk.loadSnapshot.mockRejectedValue(new Error('Read denied'));
    const denied = renderHook(() => useStore('initial', parse));
    await waitFor(() => expect(denied.result.current.error).toBe('Read denied'));
    denied.unmount();
  });
});
