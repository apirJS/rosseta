import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ModalViewportController } from './ModalViewportController.svelte';
import { TranslationModalController } from './TranslationModalController.svelte';
import {
  measureCompactModalWidth,
  measureDescriptionLayout,
} from './modal-layout-measurement';

vi.mock('./modal-layout-measurement', () => ({
  measureCompactModalWidth: vi.fn(),
  measureDescriptionLayout: vi.fn(),
}));

const frames = new Map<number, FrameRequestCallback>();

const observers: {
  callback: () => void;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}[] = [];

const translations: TranslationModalController[] = [];
let nextFrame = 0;

function createViewport() {
  const translation = new TranslationModalController({
    original: [],
    translated: [],
    description: 'Useful context',
    detachModal: vi.fn(),
  });

  translations.push(translation);

  const viewport = new ModalViewportController(() => translation);

  viewport.width = 1440;
  viewport.height = 900;
  viewport.modal = document.createElement('div');
  viewport.body = document.createElement('div');
  viewport.sections = document.createElement('div');
  viewport.textColumn = document.createElement('div');

  return { viewport, translation };
}

function flushFrame() {
  const pending = [...frames.values()];

  frames.clear();
  pending.forEach((callback) => callback(0));
}

beforeEach(() => {
  vi.mocked(measureCompactModalWidth).mockReset().mockReturnValue(undefined);
  vi.mocked(measureDescriptionLayout).mockReset();

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);

    return nextFrame;
  });

  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));

  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(callback: () => void) {
        observers.push({
          callback,
          observe: this.observe,
          disconnect: this.disconnect,
        });
      }
    },
  );
});

afterEach(() => {
  for (const translation of translations.splice(0)) translation.dispose();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  frames.clear();
  observers.splice(0);
});

describe('ModalViewportController', () => {
  test('coalesces size observations and cancels queued work after cleanup', () => {
    const { viewport } = createViewport();
    const stop = viewport.observeContent();
    const observer = observers[0];

    expect(observer.observe).toHaveBeenCalledTimes(3);
    observer.callback();
    observer.callback();
    expect(frames.size).toBe(1);
    flushFrame();
    expect(measureCompactModalWidth).toHaveBeenCalledTimes(1);
    observer.callback();
    stop?.();
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(frames.size).toBe(0);
    observer.callback();
    expect(frames.size).toBe(0);
  });

  test('waits for automatic width to reflow before deciding whether columns are needed', () => {
    const { viewport } = createViewport();

    Object.defineProperties(viewport.body!, {
      clientHeight: { value: 300 },
      scrollHeight: { value: 900 },
    });

    vi.mocked(measureCompactModalWidth).mockReturnValue(400);

    const stop = viewport.observeContent();

    flushFrame();
    expect(viewport.layout.width).toBe('400px');
    expect(viewport.layout.mode).toBe('stacked');
    expect(frames.size).toBe(1);
    flushFrame();
    expect(viewport.layout.mode).toBe('description-side');
    stop?.();
  });

  test('does not observe failure content', () => {
    const { viewport, translation } = createViewport();

    translation.cancelled();
    expect(viewport.observeContent()).toBeUndefined();
    expect(observers).toHaveLength(0);
    expect(frames.size).toBe(0);
  });

  test('resets scrolling and constrains the measured modal after automatic sizing', () => {
    const { viewport, translation } = createViewport();

    viewport.layout.setAutomaticWidth('stacked', 400);
    viewport.body!.scrollTop = 70;

    const constrain = vi.spyOn(translation.drag, 'constrainToViewport');
    const stop = viewport.constrainPosition();

    expect(viewport.body!.scrollTop).toBe(0);
    flushFrame();

    expect(constrain).toHaveBeenCalledWith(expect.anything(), {
      width: 1440,
      height: 900,
    });

    stop?.();
  });

  test('focuses the backdrop and closes only for Escape', () => {
    const { viewport, translation } = createViewport();

    viewport.backdrop = document.createElement('div');

    const focus = vi.spyOn(viewport.backdrop, 'focus');
    const close = vi.spyOn(translation, 'close');

    viewport.focusBackdrop();
    expect(focus).toHaveBeenCalledOnce();
    viewport.handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(close).not.toHaveBeenCalled();

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    const stop = vi.spyOn(event, 'stopPropagation');

    viewport.handleKeydown(event);
    expect(stop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
