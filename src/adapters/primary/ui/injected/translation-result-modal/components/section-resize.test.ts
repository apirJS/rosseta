import { afterEach, describe, expect, test, vi } from 'vitest';
import { startSectionResize } from './section-resize';

afterEach(() => document.body.replaceChildren());

function createSections() {
  const parent = document.createElement('div');

  parent.innerHTML =
    '<div class="section"><div class="text-box"></div><button></button></div><div class="section" style="flex: 1; min-height: 30px; height: 100px"></div>';

  document.body.append(parent);

  const box = parent.querySelector<HTMLElement>('.text-box')!;
  const handle = parent.querySelector('button')!;
  const sibling = parent.children[1] as HTMLElement;

  vi.spyOn(box, 'getBoundingClientRect').mockReturnValue({
    height: 100,
  } as DOMRect);

  vi.spyOn(sibling, 'getBoundingClientRect').mockReturnValue({
    height: 120,
  } as DOMRect);

  Object.assign(handle, {
    setPointerCapture: vi.fn(),
    hasPointerCapture: vi.fn().mockReturnValue(true),
    releasePointerCapture: vi.fn(),
  });

  return { box, handle, sibling };
}

describe('section resize', () => {
  test('preserves the description height when resizing text inside the shared wrapper', () => {
    const { box, handle, sibling } = createSections();
    const parent = sibling.parentElement!;
    const wrapper = document.createElement('div');
    const description = document.createElement('div');

    parent.className = 'translation-sections';
    wrapper.className = 'translation-text-sections';
    wrapper.append(box.closest('.section')!, sibling);
    description.className = 'section';
    description.style.height = '90px';
    parent.append(wrapper, description);

    vi.spyOn(description, 'getBoundingClientRect').mockReturnValue({
      height: 140,
    } as DOMRect);

    const stop = startSectionResize({
      event: {
        button: 0,
        clientY: 0,
        pointerId: 1,
        currentTarget: handle,
      } as unknown as PointerEvent,
      box,
      minHeight: 60,
    });

    expect(sibling.style.height).toBe('120px');
    expect(description.style.height).toBe('140px');
    stop();
    expect(sibling.style.height).toBe('100px');
    expect(description.style.height).toBe('90px');
  });

  test('resizes only the chosen section, clamps height, and restores siblings on completion', () => {
    const { box, handle, sibling } = createSections();
    const onEnd = vi.fn();

    const stop = startSectionResize({
      event: {
        button: 0,
        clientY: 50,
        pointerId: 1,
        currentTarget: handle,
      } as unknown as PointerEvent,
      box,
      minHeight: 60,
      onEnd,
    });

    expect(sibling.style.height).toBe('120px');
    expect(sibling.style.flex).toBe('0 0 auto');
    handle.dispatchEvent(new MouseEvent('pointermove', { clientY: -50 }));
    expect(box.style.height).toBe('60px');
    handle.dispatchEvent(new MouseEvent('pointermove', { clientY: 100 }));
    expect(box.style.height).toBe('150px');
    handle.dispatchEvent(new Event('pointerup'));
    stop();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(sibling.style.height).toBe('100px');
    expect(sibling.style.minHeight).toBe('30px');
    expect(sibling.style.flex).toBe('1 1 0%');
    handle.dispatchEvent(new MouseEvent('pointermove', { clientY: 300 }));
    expect(box.style.height).toBe('150px');
  });

  test.each(['pointercancel', 'lostpointercapture'])(
    '%s restores sibling layout',
    (event) => {
      const { box, handle, sibling } = createSections();
      const onEnd = vi.fn();

      startSectionResize({
        event: {
          button: 0,
          clientY: 0,
          pointerId: 1,
          currentTarget: handle,
        } as unknown as PointerEvent,
        box,
        minHeight: 60,
        onEnd,
      });

      handle.dispatchEvent(new Event(event));
      expect(sibling.style.height).toBe('100px');
      expect(onEnd).toHaveBeenCalledOnce();
    },
  );

  test('ignores secondary pointer buttons', () => {
    const { box, handle, sibling } = createSections();

    startSectionResize({
      event: { button: 2, currentTarget: handle } as unknown as PointerEvent,
      box,
      minHeight: 60,
    });

    expect(handle.setPointerCapture).not.toHaveBeenCalled();
    expect(sibling.style.height).toBe('100px');
  });
});
