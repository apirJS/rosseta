import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PopupToastController } from './PopupToastController.svelte';

describe('UI Controller: popup toasts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('keeps loading feedback until updated, then dismisses it after the success duration', () => {
    const controller = new PopupToastController();
    const id = controller.show({ type: 'loading', message: 'Fetching models' });

    vi.advanceTimersByTime(10_000);
    expect(controller.toasts).toHaveLength(1);

    controller.update(id, { type: 'success', message: 'Models fetched' });
    vi.advanceTimersByTime(4_000);
    expect(controller.toasts[0].dismissing).toBe(true);
    vi.advanceTimersByTime(200);
    expect(controller.toasts).toEqual([]);
  });

  test('shows the newest five notifications', () => {
    const controller = new PopupToastController();

    for (let index = 0; index < 7; index++) {
      controller.show({ type: 'info', message: String(index) });
    }

    expect(controller.toasts.map((toast) => toast.message)).toEqual([
      '6',
      '5',
      '4',
      '3',
      '2',
    ]);

    controller.dispose();
  });

  test('unmount cleanup clears duration and dismissal timers and ignores late feedback', () => {
    const controller = new PopupToastController();

    controller.show({ type: 'info', message: 'Timed' });

    const id = controller.show({ type: 'loading', message: 'Dismissed' });

    controller.dismiss(id);

    expect(vi.getTimerCount()).toBe(2);
    controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
    controller.show({ type: 'error', message: 'Late callback' });
    controller.update(id, { message: 'Late update' });
    vi.runAllTimers();
    expect(controller.toasts).toEqual([]);
  });
});
