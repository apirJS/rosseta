import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ScreenSelectionController } from './ScreenSelectionController.svelte';

describe('screen selection', () => {
  let target: HTMLDivElement;
  let updateFrame: FrameRequestCallback;
  const selected = vi.fn();

  function pointer(
    x: number,
    y: number,
    pointerId = 1,
    button = 0,
  ): PointerEvent {
    return {
      currentTarget: target,
      clientX: x,
      clientY: y,
      pointerId,
      button,
    } as unknown as PointerEvent;
  }

  beforeEach(() => {
    selected.mockReset();
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 600);

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        updateFrame = callback;

        return 12;
      }),
    );

    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    target = document.createElement('div');
    target.setPointerCapture = vi.fn();
    target.hasPointerCapture = vi.fn(() => true);
    target.releasePointerCapture = vi.fn();
  });

  afterEach(() => vi.unstubAllGlobals());

  test('renders one clamped reverse selection per animation frame', () => {
    const controller = new ScreenSelectionController(selected);

    controller.start(pointer(200, 150));
    controller.move(pointer(-50, -50));
    controller.move(pointer(50, 75));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    expect(controller.bounds).toEqual({
      left: 200,
      top: 150,
      width: 0,
      height: 0,
    });

    updateFrame(0);

    expect(controller.bounds).toEqual({
      left: 50,
      top: 75,
      width: 150,
      height: 75,
    });

    controller.cancel();
  });

  test('finishes at pointer-up coordinates even before a pending frame', async () => {
    const controller = new ScreenSelectionController(selected);

    controller.start(pointer(200, 150));
    controller.move(pointer(300, 200));
    await controller.finish(pointer(1200, 900));

    expect(selected).toHaveBeenCalledExactlyOnceWith(
      { left: 200, top: 150, width: 800, height: 450 },
      { width: 1000, height: 600 },
    );

    expect(cancelAnimationFrame).toHaveBeenCalledWith(12);
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(controller.bounds).toBeNull();
  });

  test.each([
    [100, 100],
    [109, 120],
    [120, 109],
  ])(
    'keeps selection available after a small area ends at %s,%s',
    async (x, y) => {
      const controller = new ScreenSelectionController(selected);

      controller.start(pointer(100, 100));
      await controller.finish(pointer(x, y));
      expect(selected).not.toHaveBeenCalled();
      controller.start(pointer(0, 0));
      await controller.finish(pointer(10, 10));
      expect(selected).toHaveBeenCalledTimes(1);
    },
  );

  test('ignores other pointers and secondary buttons', async () => {
    const controller = new ScreenSelectionController(selected);

    controller.start(pointer(10, 20, 2, 2));
    expect(controller.bounds).toBeNull();
    controller.start(pointer(10, 20));
    controller.start(pointer(300, 400, 2));
    controller.move(pointer(400, 400, 2));
    await controller.finish(pointer(500, 500, 2));
    controller.cancelPointer(pointer(0, 0, 2));

    expect(controller.bounds).toEqual({
      left: 10,
      top: 20,
      width: 0,
      height: 0,
    });

    expect(selected).not.toHaveBeenCalled();
    controller.cancel();
  });

  test('cancellation removes a pending frame and releases capture without submitting', () => {
    const controller = new ScreenSelectionController(selected);

    controller.start(pointer(20, 30));
    controller.move(pointer(200, 300));
    controller.cancelPointer(pointer(200, 300));
    updateFrame(0);
    expect(controller.bounds).toBeNull();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(12);
    expect(target.releasePointerCapture).toHaveBeenCalledTimes(1);
    expect(selected).not.toHaveBeenCalled();
    controller.cancel();
    expect(target.releasePointerCapture).toHaveBeenCalledTimes(1);
  });

  test('uses the selection viewport consistently after a resize', async () => {
    const controller = new ScreenSelectionController(selected);

    controller.start(pointer(0, 0));
    vi.stubGlobal('innerWidth', 500);
    await controller.finish(pointer(800, 500));

    expect(selected).toHaveBeenCalledWith(
      { left: 0, top: 0, width: 800, height: 500 },
      { width: 1000, height: 600 },
    );
  });

  test('does not begin selection while the owner is busy or disposed', () => {
    const controller = new ScreenSelectionController(selected, () => false);

    controller.start(pointer(0, 0));
    expect(target.setPointerCapture).not.toHaveBeenCalled();
    expect(controller.bounds).toBeNull();
  });
});
