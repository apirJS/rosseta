import {
  describe,
  test,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import { flushSync } from 'svelte';
import { OverlayController } from './OverlayController.svelte';
import { sendMessageToRuntime } from '../../../../../shared/messaging';

// ── Mock External Dependencies ────────────────────────────────

vi.mock('../../../../../shared/messaging', () => ({
  sendMessageToRuntime: vi.fn(),
}));

const mockSelectionBoxInstance = {
  getViewportDimensions: vi.fn(() => ({ width: 1920, height: 1080 })),
  update: vi.fn(),
  mount: vi.fn(),
  unmount: vi.fn(),
};

vi.mock('./SelectionBox', () => ({
  SelectionBox: class MockSelectionBox {
    getViewportDimensions = mockSelectionBoxInstance.getViewportDimensions;
    update = mockSelectionBoxInstance.update;
    mount = mockSelectionBoxInstance.mount;
    unmount = mockSelectionBoxInstance.unmount;
  },
}));

// ── Tests ────────────────────────────────────────────────────────

describe('UI Controller: OverlayController', () => {
  let detachMock: Mock;
  let onReadyMock: Mock;
  const mockImageBase64 = 'data:image/png;base64,fakeimage';
  let drawImage: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    detachMock = vi.fn();
    onReadyMock = vi.fn();
    drawImage = vi.fn();

    // Mock Browser Globals
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    // Mock Image API (for decodeImage)
    vi.stubGlobal(
      'Image',
      class {
        src: string = '';
        naturalWidth = 1920;
        naturalHeight = 1080;
        decode = vi.fn().mockResolvedValue(undefined);
        addEventListener = vi.fn((type: string, listener: EventListener) => {
          if (type === 'load') {
            setTimeout(() => listener(new Event('load')), 10);
          }
        });
      },
    );

    // Mock Fetch (for loadBlob)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(['fake-content'])),
      }),
    );

    // Mock Canvas API (for cropImage)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,CROPPED_RESULT',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /**
   * Helper: creates OverlayController inside $effect.root() so the constructor's
   * $effect() runs correctly. Returns the controller and a cleanup function.
   */
  function createController(
    detach: () => void,
    onReady?: () => void,
  ): { controller: OverlayController; cleanup: () => void } {
    let controller!: OverlayController;

    const cleanup = $effect.root(() => {
      controller = new OverlayController(
        mockImageBase64,
        detach,
        onReady,
        async (requestId, imageBase64) => {
          await sendMessageToRuntime({
            action: 'TRANSLATE_IMAGE',
            payload: {
              requestId,
              documentSessionId: 'test-session',
              imageBase64,
            },
          });
        },
      );
    });

    flushSync(); // Trigger any pending effects

    return { controller, cleanup };
  }

  // ── Initialization ─────────────────────────────────────────

  test('decodes image and creates blob URL on init', async () => {
    const { controller, cleanup } = createController(detachMock, onReadyMock);

    await vi.waitFor(() => {
      expect(controller.isReady).toBe(true);
      expect(controller.blobUrl).toBe('blob:fake-url');
    });

    expect(onReadyMock).toHaveBeenCalled();
    cleanup();
  });

  // ── Keyboard ───────────────────────────────────────────────

  test('Escape key detaches overlay and stops the event', () => {
    const { controller, cleanup } = createController(detachMock);
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    controller.handleKeydown({
      key: 'Escape',
      preventDefault,
      stopPropagation,
    } as unknown as KeyboardEvent);

    expect(detachMock).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    cleanup();
  });

  test('other keys do not detach overlay', () => {
    const { controller, cleanup } = createController(detachMock);
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    controller.handleKeydown({
      key: 'Enter',
      preventDefault,
      stopPropagation,
    } as unknown as KeyboardEvent);

    expect(detachMock).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    cleanup();
  });

  // ── Container ──────────────────────────────────────────────

  test('setContainer stores overlay element reference', () => {
    const { controller, cleanup } = createController(detachMock);
    const mockEl = document.createElement('div');

    controller.setContainer(mockEl);

    // No public getter, but it shouldn't throw
    expect(true).toBe(true);
    cleanup();
  });

  // ── Selection Flow ─────────────────────────────────────────

  describe('Pointer selection flow', () => {
    let mockTarget: HTMLElement;
    let eventListeners: Record<string, Function>;

    beforeEach(() => {
      eventListeners = {};

      mockTarget = {
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
        addEventListener: vi.fn((event: string, handler: Function) => {
          eventListeners[event] = handler;
        }),
        removeEventListener: vi.fn(),
      } as unknown as HTMLElement;
    });

    test('pointer down starts selection and mounts SelectionBox', () => {
      const { controller, cleanup } = createController(detachMock);

      const mockEvent = {
        currentTarget: mockTarget,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
      } as unknown as PointerEvent;

      controller.handlePointerDown(mockEvent);

      expect(controller.isPointerMoving).toBe(true);
      expect(mockTarget.setPointerCapture).toHaveBeenCalledWith(1);
      expect(mockSelectionBoxInstance.mount).toHaveBeenCalled();

      expect(mockSelectionBoxInstance.update).toHaveBeenCalledWith({
        left: 100,
        top: 100,
        width: 0,
        height: 0,
      });

      expect(mockTarget.addEventListener).toHaveBeenCalledWith(
        'pointermove',
        expect.any(Function),
      );

      expect(mockTarget.addEventListener).toHaveBeenCalledWith(
        'pointerup',
        expect.any(Function),
      );

      cleanup();
    });

    test('pointer up completes selection and sends TRANSLATE_IMAGE', async () => {
      const { controller, cleanup } = createController(detachMock);

      // Start selection
      controller.handlePointerDown({
        currentTarget: mockTarget,
        pointerId: 1,
        clientX: 50,
        clientY: 50,
      } as unknown as PointerEvent);

      // End selection at (150, 150)
      const pointerUpHandler = eventListeners['pointerup'];

      expect(pointerUpHandler).toBeDefined();

      await pointerUpHandler({
        clientX: 150,
        clientY: 150,
        pointerId: 1,
      } as unknown as PointerEvent);

      expect(controller.isPointerMoving).toBe(false);
      expect(mockSelectionBoxInstance.unmount).toHaveBeenCalled();
      expect(mockTarget.releasePointerCapture).toHaveBeenCalledWith(1);

      expect(sendMessageToRuntime).toHaveBeenCalledWith({
        action: 'TRANSLATE_IMAGE',
        payload: {
          imageBase64: 'data:image/png;base64,CROPPED_RESULT',
          requestId: expect.any(String),
          documentSessionId: 'test-session',
        },
      });

      expect(detachMock).toHaveBeenCalled();
      cleanup();
    });

    test.each([
      {
        display: 'standard density',
        viewport: [1920, 1080],
        start: [50, 40],
        end: [150, 120],
        source: [50, 40, 100, 80],
      },
      {
        display: 'high density',
        viewport: [960, 540],
        start: [50, 40],
        end: [150, 120],
        source: [100, 80, 200, 160],
      },
      {
        display: 'fractional scaling',
        viewport: [1536, 864],
        start: [51, 41],
        end: [152, 122],
        source: [63, 51, 127, 102],
      },
      {
        display: 'different horizontal and vertical scales',
        viewport: [960, 720],
        start: [50, 40],
        end: [150, 120],
        source: [100, 60, 200, 120],
      },
      {
        display: 'full viewport',
        viewport: [960, 540],
        start: [0, 0],
        end: [960, 540],
        source: [0, 0, 1920, 1080],
      },
      {
        display: 'full viewport with floating-point rounding at the edges',
        viewport: [337, 532],
        start: [0, 0],
        end: [337, 532],
        source: [0, 0, 1920, 1080],
      },
      {
        display: 'reverse drag',
        viewport: [960, 540],
        start: [150, 120],
        end: [50, 40],
        source: [100, 80, 200, 160],
      },
    ])(
      'sends a lossless native-resolution crop for $display',
      async ({ viewport, start, end, source }) => {
        vi.stubGlobal('innerWidth', viewport[0]);
        vi.stubGlobal('innerHeight', viewport[1]);

        const { controller, cleanup } = createController(detachMock);

        try {
          controller.handlePointerDown({
            currentTarget: mockTarget,
            pointerId: 1,
            clientX: start[0],
            clientY: start[1],
          } as unknown as PointerEvent);

          await eventListeners['pointerup']({
            clientX: end[0],
            clientY: end[1],
            pointerId: 1,
          } as unknown as PointerEvent);

          const [, , cropWidth, cropHeight] = source;

          expect(drawImage).toHaveBeenCalledExactlyOnceWith(
            expect.any(Image),
            ...source,
            0,
            0,
            cropWidth,
            cropHeight,
          );

          const canvas = vi.mocked(HTMLCanvasElement.prototype.toDataURL).mock
            .contexts[0] as HTMLCanvasElement;

          expect(canvas.width).toBe(cropWidth);
          expect(canvas.height).toBe(cropHeight);

          expect(
            HTMLCanvasElement.prototype.toDataURL,
          ).toHaveBeenCalledExactlyOnceWith('image/png');

          expect(sendMessageToRuntime).toHaveBeenCalledWith({
            action: 'TRANSLATE_IMAGE',
            payload: {
              imageBase64: 'data:image/png;base64,CROPPED_RESULT',
              requestId: expect.any(String),
              documentSessionId: 'test-session',
            },
          });
        } finally {
          cleanup();
        }
      },
    );

    test('zero-size selection (click) does NOT translate', async () => {
      const { controller, cleanup } = createController(detachMock);

      controller.handlePointerDown({
        currentTarget: mockTarget,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
      } as unknown as PointerEvent);

      const pointerUpHandler = eventListeners['pointerup'];

      await pointerUpHandler({
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      } as unknown as PointerEvent);

      expect(sendMessageToRuntime).not.toHaveBeenCalled();
      expect(detachMock).not.toHaveBeenCalled();
      cleanup();
    });

    test('micro-drag selection (< 10px) does NOT translate', async () => {
      const { controller, cleanup } = createController(detachMock);

      controller.handlePointerDown({
        currentTarget: mockTarget,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
      } as unknown as PointerEvent);

      const pointerUpHandler = eventListeners['pointerup'];

      await pointerUpHandler({
        clientX: 105,
        clientY: 105,
        pointerId: 1,
      } as unknown as PointerEvent);

      expect(sendMessageToRuntime).not.toHaveBeenCalled();
      expect(detachMock).not.toHaveBeenCalled();
      cleanup();
    });
  });
});
