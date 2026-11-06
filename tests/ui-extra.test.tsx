// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field, LineChart, Modal, Shell } from '../src/ui';
afterEach(cleanup);
describe('keyboard and accessible state contracts', () => {
  it('keeps a skip link on the current screen and exposes native-export errors', async () => {
    const user = userEvent.setup();
    const theme = vi.fn();
    location.hash = 'history';
    render(
      <Shell
        name="Test toolkit"
        subtitle="Testing"
        logo={<span>W</span>}
        page="history"
        theme="dark"
        onTheme={theme}
        items={[{ id: 'history', label: 'History', icon: <span>H</span>, count: 2 }]}
        footer={<span>Local only</span>}
      >
        <h1>Current history</h1>
      </Shell>,
    );
    await user.click(screen.getByText('Skip to content'));
    expect(location.hash).toBe('#history');
    expect(document.activeElement?.id).toBe('content');
    await user.click(screen.getByRole('button', { name: 'Light appearance' }));
    expect(theme).toHaveBeenCalledOnce();
    fireEvent(window, new CustomEvent('export-error', { detail: 'No share application' }));
    expect(screen.getByRole('alert').textContent).toContain('No share application');
    await user.click(screen.getByRole('button', { name: 'Dismiss export error' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('associates a form hint, exposes unavailable chart samples, and keeps modal cancellation functional', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const submit = vi.fn((event) => event.preventDefault());
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    const modal = render(
      <Modal title="Record" close={close} submit={submit}>
        <Field label="Amount" wide>
          <input defaultValue="12" />
          <small>Original currency</small>
        </Field>
      </Modal>,
    );
    const input = screen.getByLabelText('Amount');
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save record' }));
    expect(submit).toHaveBeenCalledOnce();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true }));
    expect(close).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    modal.unmount();
    const graph = render(<LineChart values={[null, 10, 20, null]} labels={['A', 'B', 'C', 'D']} unit="ms" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('A: missing');
    graph.unmount();
    render(<LineChart values={[null]} labels={['unavailable']} unit="ms" />);
    expect(screen.getByText('A little more data, a clearer picture.')).toBeTruthy();
  });
});
