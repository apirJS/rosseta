import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { ToastController } from './ToastController.svelte';

describe('UI Controller: ToastController', () => {
  let controller: ToastController;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new ToastController();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── show() ─────────────────────────────────────────────────────

  test('show() adds a toast and returns its id', () => {
    const id = controller.show({ type: 'success', message: 'Done!' });

    expect(id).toBeTypeOf('string');
    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0].type).toBe('success');
    expect(controller.toasts[0].message).toBe('Done!');
  });

  test('show() prepends newest toast to top', () => {
    controller.show({ type: 'info', message: 'First' });
    controller.show({ type: 'info', message: 'Second' });

    expect(controller.toasts[0].message).toBe('Second');
    expect(controller.toasts[1].message).toBe('First');
  });

  test('show() caps at MAX_TOASTS (5)', () => {
    for (let i = 0; i < 7; i++) {
      controller.show({ type: 'info', message: `Toast ${i}` });
    }

    expect(controller.toasts).toHaveLength(5);
    // Newest should be first
    expect(controller.toasts[0].message).toBe('Toast 6');
  });

  test('show() uses custom id when provided', () => {
    const id = controller.show({
      type: 'info',
      message: 'Hello',
      id: 'custom-id',
    });

    expect(id).toBe('custom-id');
    expect(controller.toasts[0].id).toBe('custom-id');
  });

  test('show() includes description when provided', () => {
    controller.show({
      type: 'error',
      message: 'Error!',
      description: 'Something went wrong',
    });

    expect(controller.toasts[0].description).toBe('Something went wrong');
  });

  // ── Auto-dismiss ───────────────────────────────────────────────

  test('non-loading toasts auto-dismiss after default 4000ms', () => {
    controller.show({ type: 'success', message: 'Done!' });

    expect(controller.toasts).toHaveLength(1);

    // Advance past auto-dismiss timer
    vi.advanceTimersByTime(4000);
    // Toast enters dismissing state
    expect(controller.toasts[0]?.dismissing).toBe(true);

    // After dismiss animation (250ms), toast is removed
    vi.advanceTimersByTime(250);
    expect(controller.toasts).toHaveLength(0);
  });

  test('loading toasts do NOT auto-dismiss (duration defaults to 0)', () => {
    controller.show({ type: 'loading', message: 'Processing...' });

    vi.advanceTimersByTime(10000);

    // Still present
    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0].type).toBe('loading');
  });

  test('custom duration overrides default', () => {
    controller.show({ type: 'info', message: 'Quick', duration: 1000 });

    vi.advanceTimersByTime(1000);
    expect(controller.toasts[0]?.dismissing).toBe(true);

    vi.advanceTimersByTime(250);
    expect(controller.toasts).toHaveLength(0);
  });

  // ── dismiss() ──────────────────────────────────────────────────

  test('dismiss() sets dismissing=true, then removes after animation', () => {
    const id = controller.show({ type: 'info', message: 'Bye', duration: 0 });

    controller.dismiss(id);

    // Immediately: dismissing flag is set
    expect(controller.toasts[0].dismissing).toBe(true);

    // After animation delay
    vi.advanceTimersByTime(250);
    expect(controller.toasts).toHaveLength(0);
  });

  test('dismiss() no-ops for unknown id', () => {
    controller.show({ type: 'info', message: 'Stay', duration: 0 });

    controller.dismiss('nonexistent-id');

    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0].dismissing).toBeUndefined();
  });

  // ── update() ───────────────────────────────────────────────────

  test('update() modifies an existing toast', () => {
    const id = controller.show({
      type: 'loading',
      message: 'Loading...',
    });

    controller.update(id, { type: 'success', message: 'Complete!' });

    expect(controller.toasts[0].type).toBe('success');
    expect(controller.toasts[0].message).toBe('Complete!');
    // updated type is non-loading, so it gets an auto-dismiss timer
  });

  test('update() resets dismissing state', () => {
    const id = controller.show({ type: 'info', message: 'Old', duration: 0 });
    controller.dismiss(id);
    expect(controller.toasts[0].dismissing).toBe(true);

    // Update before animation finishes
    controller.update(id, { message: 'Refreshed' });

    expect(controller.toasts[0].dismissing).toBe(false);
    expect(controller.toasts[0].message).toBe('Refreshed');
  });

  test('update() no-ops for unknown id', () => {
    controller.show({ type: 'info', message: 'Stay' });

    controller.update('nonexistent', { message: 'Changed' });

    expect(controller.toasts[0].message).toBe('Stay');
  });

  test('update() from loading to success starts auto-dismiss', () => {
    const id = controller.show({ type: 'loading', message: 'Processing...' });

    // Loading doesn't auto-dismiss
    vi.advanceTimersByTime(10000);
    expect(controller.toasts).toHaveLength(1);

    // Update to success → now it should auto-dismiss
    controller.update(id, { type: 'success', message: 'Done!' });

    vi.advanceTimersByTime(4000);
    expect(controller.toasts[0]?.dismissing).toBe(true);

    vi.advanceTimersByTime(250);
    expect(controller.toasts).toHaveLength(0);
  });
});
