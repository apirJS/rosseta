import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApiKeyViewerController } from './ApiKeyViewerController.svelte';

function setup() {
  const copyText = vi
    .fn<(value: string) => Promise<void>>()
    .mockResolvedValue();

  const show = vi.fn().mockReturnValue('toast');

  const controller = createApiKeyViewerController({
    copyText,
    toast: { show },
  });

  return { controller, copyText, show };
}

describe('API key viewer controller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('reveals the selected key and removes it when closed', () => {
    const { controller } = setup();

    controller.open('first-key');
    expect(controller.state.apiKey).toBe('first-key');
    controller.close();
    expect(controller.state.apiKey).toBeNull();
  });

  test('copies only a revealed key and expires the success feedback', async () => {
    const { controller, copyText } = setup();

    await controller.copy();
    expect(copyText).not.toHaveBeenCalled();
    controller.open('secret-key');
    await controller.copy();
    expect(copyText).toHaveBeenCalledWith('secret-key');
    expect(controller.state.copied).toBe(true);
    await vi.advanceTimersByTimeAsync(1500);
    expect(controller.state.copied).toBe(false);
  });

  test('starts a fresh feedback window on another copy', async () => {
    const { controller } = setup();

    controller.open('secret-key');
    await controller.copy();
    await vi.advanceTimersByTimeAsync(1000);
    await controller.copy();
    await vi.advanceTimersByTimeAsync(500);
    expect(controller.state.copied).toBe(true);
    controller.close();
    expect(vi.getTimerCount()).toBe(0);
    expect(controller.state.copied).toBe(false);
  });

  test('opening another key ignores an earlier pending clipboard result', async () => {
    const { controller, copyText } = setup();
    let finish!: () => void;

    copyText.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );

    controller.open('first-key');

    const copying = controller.copy();

    controller.open('second-key');
    finish();
    await copying;
    expect(controller.state.apiKey).toBe('second-key');
    expect(controller.state.copied).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('reports clipboard failure without claiming a successful copy', async () => {
    const { controller, copyText, show } = setup();

    copyText.mockRejectedValue(new Error('Permission denied'));
    controller.open('secret-key');
    await controller.copy();
    expect(controller.state.copied).toBe(false);

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Could not copy API key',
      }),
    );
  });
});
