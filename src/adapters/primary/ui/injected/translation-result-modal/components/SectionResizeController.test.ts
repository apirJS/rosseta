import { afterEach, describe, expect, test, vi } from 'vitest';
import { SectionResizeController } from './SectionResizeController';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function resizeFixture() {
  const section = document.createElement('div');
  const box = document.createElement('div');
  const handle = document.createElement('button');

  section.className = 'section';
  section.append(box, handle);
  document.body.append(section);

  vi.spyOn(box, 'getBoundingClientRect').mockReturnValue({
    height: 100,
  } as DOMRect);

  Object.assign(handle, {
    setPointerCapture: vi.fn(),
    hasPointerCapture: vi.fn().mockReturnValue(true),
    releasePointerCapture: vi.fn(),
  });

  const onresizestart = vi.fn();
  const onresizeend = vi.fn();

  const controller = new SectionResizeController(() => ({
    box,
    minHeight: 60,
    onresizestart,
    onresizeend,
  }));

  const event = {
    currentTarget: handle,
    pointerId: 1,
    clientY: 50,
    button: 0,
  } as unknown as PointerEvent;

  return { box, handle, controller, event, onresizestart, onresizeend };
}

describe('section resize controller', () => {
  test('owns one resize and ends it when the pointer is released', () => {
    const { box, handle, controller, event, onresizestart, onresizeend } =
      resizeFixture();

    controller.start(event);
    handle.dispatchEvent(new MouseEvent('pointermove', { clientY: 80 }));
    expect(box.style.height).toBe('130px');
    expect(onresizestart).toHaveBeenCalledOnce();
    handle.dispatchEvent(new Event('pointerup'));
    controller.dispose();
    expect(onresizeend).toHaveBeenCalledOnce();
  });

  test('stops a preceding gesture before starting another', () => {
    const { controller, event, onresizestart, onresizeend } = resizeFixture();

    controller.start(event);
    controller.start(event);
    expect(onresizestart).toHaveBeenCalledTimes(2);
    expect(onresizeend).toHaveBeenCalledOnce();
    controller.dispose();
    expect(onresizeend).toHaveBeenCalledTimes(2);
  });

  test('disposal removes listeners, releases capture, and rejects later gestures', () => {
    const { box, handle, controller, event, onresizestart, onresizeend } =
      resizeFixture();

    controller.start(event);
    controller.dispose();
    controller.dispose();
    controller.start(event);
    handle.dispatchEvent(new MouseEvent('pointermove', { clientY: 200 }));
    expect(box.style.height).toBe('');
    expect(handle.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(onresizestart).toHaveBeenCalledOnce();
    expect(onresizeend).toHaveBeenCalledOnce();
  });

  test('secondary buttons do not interrupt an active resize', () => {
    const { handle, controller, event, onresizestart, onresizeend } =
      resizeFixture();

    controller.start(event);
    controller.start({ ...event, button: 2 } as PointerEvent);
    expect(onresizestart).toHaveBeenCalledOnce();
    expect(onresizeend).not.toHaveBeenCalled();
    handle.dispatchEvent(new Event('pointercancel'));
    expect(onresizeend).toHaveBeenCalledOnce();
    controller.dispose();
  });
});
