import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { OverlayController } from './OverlayController.svelte';
import { cropSelectionImage } from './crop-selection-image';

vi.mock('./crop-selection-image', () => ({ cropSelectionImage: vi.fn() }));

async function select(controller: OverlayController): Promise<void> {
  const target = document.createElement('div');

  target.setPointerCapture = vi.fn();
  target.hasPointerCapture = vi.fn(() => true);
  target.releasePointerCapture = vi.fn();

  controller.selection.start({
    currentTarget: target,
    pointerId: 1,
    button: 0,
    clientX: 10,
    clientY: 10,
  } as unknown as PointerEvent);

  await controller.selection.finish({
    pointerId: 1,
    clientX: 100,
    clientY: 100,
  } as PointerEvent);
}

describe('selection overlay lifetime', () => {
  const decode = vi.fn();
  const detach = vi.fn();
  const ready = vi.fn();
  const startTranslation = vi.fn();

  function createController() {
    const controller = new OverlayController({
      image: () => 'data:image/png;base64,source',
      detach,
      onReady: ready,
      startTranslation,
    });

    controller.mount();

    return controller;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    decode.mockReset().mockResolvedValue(undefined);
    startTranslation.mockResolvedValue(undefined);

    vi.mocked(cropSelectionImage)
      .mockReset()
      .mockResolvedValue('data:image/png;base64,cropped');

    vi.stubGlobal(
      'Image',
      class {
        src = '';
        decode = decode;
      },
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['image'])),
      }),
    );

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:selection');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('shows the decoded image and releases the background URL on disposal', async () => {
    const controller = createController();

    await vi.waitFor(() => {
      expect(controller.isReady).toBe(true);
      expect(controller.blobUrl).toBe('blob:selection');
    });

    expect(ready).toHaveBeenCalledTimes(1);
    controller.dispose();
    controller.dispose();

    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      'blob:selection',
    );
  });

  test('releases URLs produced after disposal without announcing readiness', async () => {
    let resolveDecode!: () => void;
    let resolveBlob!: (blob: Blob) => void;

    decode.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDecode = resolve;
      }),
    );

    vi.mocked(fetch).mockResolvedValue({
      blob: () =>
        new Promise<Blob>((resolve) => {
          resolveBlob = resolve;
        }),
    } as Response);

    const controller = createController();

    await Promise.resolve();
    controller.dispose();
    resolveDecode();
    resolveBlob(new Blob(['image']));

    await vi.waitFor(() =>
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:selection'),
    );

    expect(ready).not.toHaveBeenCalled();
    expect(controller.blobUrl).toBeNull();
  });

  test('uses the original screenshot when creating the blob fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('blob unavailable'));

    const controller = createController();

    await vi.waitFor(() => expect(controller.isReady).toBe(true));

    expect(controller.backgroundStyle).toContain(
      'url(data:image/png;base64,source)',
    );

    controller.dispose();
  });

  test('closes after an invalid screenshot instead of leaving an invisible overlay', async () => {
    decode.mockRejectedValue(new Error('decode failed'));

    const controller = createController();

    await vi.waitFor(() => expect(detach).toHaveBeenCalledTimes(1));
    expect(ready).not.toHaveBeenCalled();
    controller.dispose();
  });

  test('detaches before sending one cropped selection', async () => {
    const controller = createController();

    await vi.waitFor(() => expect(controller.isReady).toBe(true));
    await select(controller);

    expect(cropSelectionImage).toHaveBeenCalledWith(
      'data:image/png;base64,source',
      { left: 10, top: 10, width: 90, height: 90 },
      { width: window.innerWidth, height: window.innerHeight },
    );

    expect(detach).toHaveBeenCalledTimes(1);

    expect(startTranslation).toHaveBeenCalledExactlyOnceWith(
      expect.any(String),
      'data:image/png;base64,cropped',
    );

    expect(detach.mock.invocationCallOrder[0]).toBeLessThan(
      startTranslation.mock.invocationCallOrder[0],
    );

    await select(controller);
    expect(startTranslation).toHaveBeenCalledTimes(1);
  });

  test('keeps selection available when cropping fails', async () => {
    vi.mocked(cropSelectionImage).mockRejectedValueOnce(
      new Error('canvas unavailable'),
    );

    const controller = createController();

    await vi.waitFor(() => expect(controller.isReady).toBe(true));
    await select(controller);
    expect(detach).not.toHaveBeenCalled();
    expect(controller.isCropping).toBe(false);
    await select(controller);
    expect(startTranslation).toHaveBeenCalledTimes(1);
  });

  test('Escape cancels pending cropping and consumes only the Escape event', async () => {
    let finishCrop!: (image: string) => void;

    vi.mocked(cropSelectionImage).mockReturnValue(
      new Promise((resolve) => {
        finishCrop = resolve;
      }),
    );

    const controller = createController();

    await vi.waitFor(() => expect(controller.isReady).toBe(true));

    const selection = select(controller);

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      cancelable: true,
    });

    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
    });

    controller.handleKeydown(enter);
    expect(enter.defaultPrevented).toBe(false);
    controller.handleKeydown(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(detach).toHaveBeenCalledTimes(1);
    finishCrop('cropped');
    await selection;
    expect(startTranslation).not.toHaveBeenCalled();
  });

  test('logs rejected translation startup without an unhandled rejection', async () => {
    startTranslation.mockRejectedValue(new Error('delivery failed'));

    const controller = createController();

    await vi.waitFor(() => expect(controller.isReady).toBe(true));
    await select(controller);

    expect(console.error).toHaveBeenCalledWith(
      'Failed to start translation:',
      expect.any(Error),
    );
  });
});
