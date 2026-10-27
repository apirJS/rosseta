import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import ToastContainer from './ToastContainer.svelte';
import { ToastController } from './ToastController.svelte';

describe('ToastContainer', () => {
  let controller: ToastController;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new ToastController();
  });

  afterEach(() => {
    cleanup();
    controller.dispose();
    vi.useRealTimers();
  });

  test('renders notification details and routes actions through the controller', async () => {
    const action = vi.fn();

    controller.show({
      type: 'error',
      message: 'Translation failed',
      description: 'Provider unavailable',
      onAction: action,
    });

    const view = render(ToastContainer, { controller });

    expect(view.getByText('Provider unavailable')).toBeTruthy();
    expect(view.container.querySelector('.toast-icon.error')).toBeTruthy();
    await fireEvent.click(view.getByRole('button', { name: 'Retry' }));

    expect(action).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector('.toast.dismissing')).toBeTruthy();

    expect(
      (view.getByRole('button', { name: 'Retry' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    flushSync(() => vi.advanceTimersByTime(250));
    expect(view.queryByText('Translation failed')).toBeNull();
  });

  test('routes manual dismissal through the controller', async () => {
    controller.show({ type: 'info', message: 'Notification', duration: 0 });

    const view = render(ToastContainer, { controller });

    await fireEvent.click(view.getByRole('button', { name: 'Close toast' }));
    flushSync(() => vi.advanceTimersByTime(250));

    expect(view.queryByText('Notification')).toBeNull();
  });

  test('updates the existing notification element when the same ID changes', () => {
    controller.show({ id: 'job', type: 'loading', message: 'Processing' });

    const view = render(ToastContainer, { controller });
    const notification = view.container.querySelector('.toast');

    flushSync(() =>
      controller.update('job', { type: 'success', message: 'Complete' }),
    );

    expect(view.getByText('Complete')).toBeTruthy();
    expect(view.container.querySelector('.toast')).toBe(notification);
    expect(view.container.querySelector('.toast-icon.success')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  test('unmounting clears visible notifications and their timers', () => {
    controller.show({ type: 'info', message: 'Waiting' });

    const view = render(ToastContainer, { controller });

    view.unmount();

    expect(controller.toasts).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
