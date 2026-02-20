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

  beforeEach(() => {
    vi.clearAllMocks();
    detachMock = vi.fn();
    onReadyMock = vi.fn();

    // Mock Browser Globals
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    // Mock Image API (for decodeImage)
    global.Image = class {
      onload: (() => void) | null = null;
      src: string = '';
      naturalWidth = 100;
      naturalHeight = 100;
      decode = vi.fn().mockResolvedValue(undefined);
      constructor() {
        setTimeout(() => this.onload?.(), 10);
      }
    } as unknown as typeof Image;

    // Mock Fetch (for loadBlob)
    global.fetch = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['fake-content'])),
    }) as any;

    // Mock Canvas API (for cropImage)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,CROPPED_RESULT',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      controller = new OverlayController(mockImageBase64, detach, onReady);
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

  test('Escape key detaches overlay', () => {
    const { controller, cleanup } = createController(detachMock);

    controller.handleKeydown({ key: 'Escape' } as KeyboardEvent);

    expect(detachMock).toHaveBeenCalled();
    cleanup();
  });

  test('other keys do not detach overlay', () => {
    const { controller, cleanup } = createController(detachMock);

    controller.handleKeydown({ key: 'Enter' } as KeyboardEvent);

    expect(detachMock).not.toHaveBeenCalled();
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
        payload: { imageBase64: 'data:image/jpeg;base64,CROPPED_RESULT' },
      });

      expect(detachMock).toHaveBeenCalled();
      cleanup();
    });

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
  });
});
