import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ToastController } from './ToastController.svelte';

describe('ToastController', () => {
  let controller: ToastController;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new ToastController();
  });

  afterEach(() => {
    controller.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('shows the newest notification first with its message and description', () => {
    controller.show({ type: 'info', message: 'First' });

    const id = controller.show({
      type: 'success',
      message: 'Done',
      description: 'Saved to history',
    });

    expect(controller.toasts.map((toast) => toast.message)).toEqual([
      'Done',
      'First',
    ]);

    expect(controller.toasts[0]).toMatchObject({
      id,
      type: 'success',
      description: 'Saved to history',
    });
  });

  test('keeps five notifications and cancels timers for evicted ones', () => {
    for (let index = 0; index < 7; index++) {
      controller.show({ type: 'info', message: `Toast ${index}` });
    }

    expect(controller.toasts.map((toast) => toast.message)).toEqual([
      'Toast 6',
      'Toast 5',
      'Toast 4',
      'Toast 3',
      'Toast 2',
    ]);

    expect(vi.getTimerCount()).toBe(5);
  });

  test('replaces a repeated ID and cancels its previous expiration', () => {
    controller.show({ id: 'job', type: 'info', message: 'Old', duration: 10 });
    controller.show({ id: 'job', type: 'loading', message: 'New' });
    vi.advanceTimersByTime(5000);

    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0]).toMatchObject({ id: 'job', message: 'New' });
    expect(vi.getTimerCount()).toBe(0);
  });

  test('automatically dismisses a completed notification after four seconds', () => {
    controller.show({ type: 'success', message: 'Done' });
    vi.advanceTimersByTime(3999);
    expect(controller.toasts[0].dismissing).toBeUndefined();

    vi.advanceTimersByTime(1);
    expect(controller.toasts[0].dismissing).toBe(true);

    vi.advanceTimersByTime(250);
    expect(controller.toasts).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('keeps loading notifications until explicitly dismissed', () => {
    controller.show({ type: 'loading', message: 'Processing' });
    vi.advanceTimersByTime(60_000);

    expect(controller.toasts).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('uses explicit durations, including persistent completed notifications', () => {
    controller.show({ type: 'success', message: 'Persistent', duration: 0 });
    controller.show({ type: 'loading', message: 'Brief', duration: 100 });
    vi.advanceTimersByTime(350);

    expect(controller.toasts.map((toast) => toast.message)).toEqual([
      'Persistent',
    ]);
  });

  test('starts the completed notification timer when loading finishes', () => {
    const id = controller.show({ type: 'loading', message: 'Processing' });

    controller.update(id, { type: 'success', message: 'Complete' });
    vi.advanceTimersByTime(4000);

    expect(controller.toasts[0]).toMatchObject({
      type: 'success',
      message: 'Complete',
      dismissing: true,
    });
  });

  test('restarts expiration when a notification is updated', () => {
    const id = controller.show({ type: 'info', message: 'Old', duration: 100 });

    vi.advanceTimersByTime(50);
    controller.update(id, { message: 'New', duration: 200 });
    vi.advanceTimersByTime(100);
    expect(controller.toasts[0].dismissing).toBe(false);

    vi.advanceTimersByTime(100);
    expect(controller.toasts[0].dismissing).toBe(true);
  });

  test('updating during dismissal cancels the pending removal', () => {
    const id = controller.show({ type: 'info', message: 'Old', duration: 0 });

    controller.dismiss(id);
    vi.advanceTimersByTime(100);
    controller.update(id, { message: 'Refreshed', duration: 0 });
    vi.advanceTimersByTime(1000);

    expect(controller.toasts[0]).toMatchObject({
      message: 'Refreshed',
      dismissing: false,
    });

    expect(vi.getTimerCount()).toBe(0);
  });

  test('showing a replacement during dismissal cancels the pending removal', () => {
    controller.show({ id: 'job', type: 'info', message: 'Old' });
    controller.dismiss('job');
    controller.show({ id: 'job', type: 'loading', message: 'Replacement' });
    vi.advanceTimersByTime(1000);

    expect(controller.toasts[0].message).toBe('Replacement');
  });

  test('repeated dismissal preserves the first removal deadline', () => {
    const id = controller.show({ type: 'info', message: 'Bye', duration: 0 });

    controller.dismiss(id);
    vi.advanceTimersByTime(200);
    controller.dismiss(id);
    vi.advanceTimersByTime(50);

    expect(controller.toasts).toHaveLength(0);
  });

  test('ignores updates, dismissals and actions for unknown notifications', async () => {
    controller.show({ type: 'info', message: 'Stay', duration: 0 });
    controller.update('unknown', { message: 'Changed' });
    controller.dismiss('unknown');
    await controller.activate('unknown');

    expect(controller.toasts[0].message).toBe('Stay');
    expect(vi.getTimerCount()).toBe(0);
  });

  test('invokes an action once and dismisses its notification', async () => {
    let finish: (() => void) | undefined;

    const onAction = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );

    const id = controller.show({ type: 'error', message: 'Failed', onAction });

    const action = controller.activate(id);

    await controller.activate(id);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(controller.toasts[0].dismissing).toBe(true);
    finish?.();
    await action;
    vi.advanceTimersByTime(250);
    expect(controller.toasts).toHaveLength(0);
  });

  test.each(['throws', 'rejects'])(
    'handles an action that %s without an unhandled error',
    async (failure) => {
      const error = new Error('Retry failed');

      const log = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const onAction =
        failure === 'throws'
          ? () => {
              throw error;
            }
          : () => Promise.reject(error);

      const id = controller.show({
        type: 'error',
        message: 'Failed',
        onAction,
      });

      await expect(controller.activate(id)).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledWith('Failed to run toast action:', error);
      vi.advanceTimersByTime(250);
      expect(controller.toasts).toHaveLength(0);
    },
  );

  test('clearing cancels expiration and animation timers while allowing reuse', () => {
    const id = controller.show({ type: 'success', message: 'Dismissing' });

    controller.dismiss(id);
    controller.show({ type: 'info', message: 'Waiting' });
    controller.clear();

    expect(vi.getTimerCount()).toBe(0);
    expect(controller.toasts).toHaveLength(0);
    controller.show({ type: 'loading', message: 'New mount' });
    expect(controller.toasts[0].message).toBe('New mount');
  });

  test('disposal cancels timers and ignores later operations', async () => {
    const action = vi.fn();

    const id = controller.show({
      type: 'error',
      message: 'Failed',
      onAction: action,
    });

    controller.dismiss(id);
    controller.dispose();
    controller.dispose();
    controller.show({ type: 'success', message: 'Late' });
    controller.update(id, { message: 'Late' });
    controller.dismiss(id);
    await controller.activate(id);

    expect(controller.toasts).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(action).not.toHaveBeenCalled();
  });
});
