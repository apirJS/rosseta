import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TranslationCopyController } from './TranslationCopyController.svelte';

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TranslationCopyController', () => {
  test('copy feedback has an independent, renewable timer per section', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.assign(navigator, { clipboard: { writeText } });

    const controller = new TranslationCopyController();

    await controller.copy('original', 'source');
    vi.advanceTimersByTime(1_000);
    await controller.copy('translated', 'translation');
    await controller.copy('original', 'source again');
    vi.advanceTimersByTime(1_000);

    expect(controller.states).toEqual({
      original: 'copied',
      translated: 'copied',
      description: 'idle',
    });

    vi.advanceTimersByTime(1_000);

    expect(controller.states).toEqual({
      original: 'idle',
      translated: 'idle',
      description: 'idle',
    });

    expect(writeText.mock.calls).toEqual([
      ['source'],
      ['translation'],
      ['source again'],
    ]);

    controller.dispose();
  });

  test.each(['reset', 'dispose'] as const)(
    '%s invalidates pending clipboard feedback',
    async (action) => {
      let resolveCopy!: () => void;

      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn(
            () =>
              new Promise<void>((resolve) => {
                resolveCopy = resolve;
              }),
          ),
        },
      });

      const controller = new TranslationCopyController();
      const copying = controller.copy('description', 'old description');

      controller[action]();
      resolveCopy();
      await copying;
      expect(controller.states.description).toBe('idle');
      expect(vi.getTimerCount()).toBe(0);
      controller.dispose();
    },
  );

  test('reset clears displayed feedback and timers', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    const controller = new TranslationCopyController();

    await controller.copy('translated', 'translation');
    controller.reset();
    expect(controller.states.translated).toBe('idle');
    expect(vi.getTimerCount()).toBe(0);
    controller.dispose();
  });
});
