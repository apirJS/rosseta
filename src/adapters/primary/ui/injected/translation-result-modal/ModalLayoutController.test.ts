import { describe, expect, test } from 'vitest';
import {
  ModalLayoutController,
  type ModalLayoutMode,
} from './ModalLayoutController.svelte';

function createController(hasDescription = false): ModalLayoutController {
  const controller = new ModalLayoutController();

  setContent(controller, { hasDescription });

  return controller;
}

function setContent(
  controller: ModalLayoutController,
  overrides: Partial<Parameters<ModalLayoutController['setContent']>[0]> = {},
): void {
  controller.setContent({
    revision: 0,
    hasContent: true,
    hasDescription: true,
    unsuccessful: false,
    ...overrides,
  });
}

function measure(
  controller: ModalLayoutController,
  overrides: Partial<Parameters<ModalLayoutController['measure']>[0]> = {},
): void {
  controller.measure({
    renderedMode: controller.mode,
    overflowing: false,
    textColumnOverflowing: false,
    textStackHeight: Infinity,
    viewportWidth: 1440,
    availableHeight: 600,
    ...overrides,
  });
}

function expand(controller: ModalLayoutController): void {
  measure(controller, { overflowing: true });
}

function useThreeColumns(controller: ModalLayoutController): void {
  expand(controller);
  measure(controller, { textColumnOverflowing: true });
  measure(controller);

  expect(controller.mode).toBe('three-columns');
}

describe('ModalLayoutController', () => {
  test('uses a measured width without replacing the readable minimum or preferred limit', () => {
    const controller = createController();

    expect(controller.setAutomaticWidth('stacked', 340)).toBe(true);
    expect(controller.width).toBe('340px');
    expect(controller.minimumWidth).toBe(320);
    expect(controller.preferredWidth).toBe(520);
    expect(controller.setAutomaticWidth('stacked', 340)).toBe(false);

    expand(controller);
    expect(controller.width).toBe('850px');
    expect(controller.minimumWidth).toBe(610);
    expect(controller.preferredWidth).toBe(850);
    expect(controller.setAutomaticWidth('text-columns', 650)).toBe(true);
    expect(controller.width).toBe('650px');
    expect(controller.setAutomaticWidth('stacked', 320)).toBe(false);
    expect(controller.width).toBe('650px');
  });

  test.each([0, -1, NaN, Infinity])(
    'ignores an unusable automatic width %s',
    (width) => {
      const controller = createController();

      expect(controller.setAutomaticWidth('stacked', width)).toBe(false);
      expect(controller.width).toBeUndefined();
    },
  );

  test('clears the automatic width on a new attempt or description change', () => {
    const controller = createController();

    controller.setAutomaticWidth('stacked', 340);
    setContent(controller, { revision: 1, hasDescription: false });
    expect(controller.width).toBeUndefined();

    controller.setAutomaticWidth('stacked', 360);
    setContent(controller, { revision: 1, hasDescription: true });
    expect(controller.width).toBeUndefined();
  });

  test('keeps short results stacked even when columns would fit', () => {
    const controller = createController(true);

    measure(controller);

    expect(controller.mode).toBe('stacked');
    expect(controller.columns).toBe(1);
    expect(controller.width).toBeUndefined();
    expect(controller.minWidth).toBeUndefined();
    expect(controller.descriptionSideWidth).toBe(850);
  });

  test.each([
    { hasDescription: false, mode: 'text-columns' },
    { hasDescription: true, mode: 'description-side' },
  ])(
    'tries $mode first when the stacked body overflows',
    ({ hasDescription, mode }) => {
      const controller = createController(hasDescription);

      measure(controller, {
        overflowing: true,
        textColumnOverflowing: true,
      });

      expect(controller.mode).toBe(mode);
      expect(controller.columns).toBe(2);
      expect(controller.width).toBe('850px');
      expect(controller.minWidth).toBe('610px');
    },
  );

  test('uses three columns only after the actual left text column overflows', () => {
    const controller = createController(true);

    expand(controller);
    measure(controller, { textColumnOverflowing: true });

    expect(controller.mode).toBe('three-columns');
    expect(controller.columns).toBe(3);
    expect(controller.width).toBe('1266px');
    expect(controller.minWidth).toBe('906px');
  });

  test('keeps the description beside the text when only the description is long', () => {
    const controller = createController(true);

    expand(controller);
    measure(controller, { overflowing: true, textColumnOverflowing: false });
    measure(controller, { overflowing: true, textColumnOverflowing: false });

    expect(controller.mode).toBe('description-side');
  });

  test.each([
    { hasDescription: false, mode: 'text-columns' },
    { hasDescription: true, mode: 'description-side' },
  ])(
    'keeps $mode after body overflow disappears',
    ({ hasDescription, mode }) => {
      const controller = createController(hasDescription);

      expand(controller);
      measure(controller);
      measure(controller);

      expect(controller.mode).toBe(mode);
    },
  );

  test('keeps three columns after text overflow disappears', () => {
    const controller = createController(true);

    useThreeColumns(controller);
    measure(controller);
    measure(controller);

    expect(controller.mode).toBe('three-columns');
  });

  test('ignores stale geometry before updating the window width or overflow state', () => {
    const controller = createController(true);

    expand(controller);

    measure(controller, {
      renderedMode: 'stacked',
      textColumnOverflowing: true,
      viewportWidth: 600,
      availableHeight: 2000,
      textStackHeight: 100,
    });

    expect(controller.mode).toBe('description-side');

    measure(controller, { textColumnOverflowing: true });
    expect(controller.mode).toBe('three-columns');

    measure(controller, {
      renderedMode: 'description-side',
      viewportWidth: 600,
      textStackHeight: 100,
    });

    expect(controller.mode).toBe('three-columns');
  });

  test('tries the description beside existing text columns when it arrives later', () => {
    const controller = createController();

    expand(controller);
    expect(controller.mode).toBe('text-columns');

    setContent(controller, { hasDescription: true });
    expect(controller.mode).toBe('description-side');

    measure(controller, { textColumnOverflowing: true });
    expect(controller.mode).toBe('three-columns');

    setContent(controller, { hasDescription: false });
    expect(controller.mode).toBe('text-columns');

    setContent(controller, { hasDescription: true });
    expect(controller.mode).toBe('description-side');
  });

  test('preserves the layout when content updates without changing description presence', () => {
    const controller = createController(true);

    useThreeColumns(controller);
    setContent(controller);

    expect(controller.mode).toBe('three-columns');
  });

  test('keeps two columns when three cannot fit and expands after widening if text still overflows', () => {
    const controller = createController(true);

    measure(controller, { overflowing: true, viewportWidth: 800 });
    measure(controller, { textColumnOverflowing: true, viewportWidth: 800 });

    expect(controller.mode).toBe('description-side');
    expect(controller.minWidth).toBe('610px');

    measure(controller, { viewportWidth: 1440, textColumnOverflowing: true });
    expect(controller.mode).toBe('three-columns');
  });

  test('stays stacked in a narrow window and tries the fluid layout after widening', () => {
    const controller = createController(true);

    measure(controller, { overflowing: true, viewportWidth: 600 });

    expect(controller.mode).toBe('stacked');
    expect(controller.width).toBeUndefined();
    expect(controller.minWidth).toBeUndefined();

    measure(controller, { viewportWidth: 1440 });

    expect(controller.mode).toBe('description-side');
  });

  test('keeps three columns when width changes but the two-column text would still overflow', () => {
    const controller = createController(true);

    useThreeColumns(controller);
    measure(controller, { viewportWidth: 1600, textStackHeight: 700 });
    expect(controller.mode).toBe('three-columns');

    measure(controller, { viewportWidth: 1440, textStackHeight: 700 });
    expect(controller.mode).toBe('three-columns');

    measure(controller, { viewportWidth: 1800, textStackHeight: 700 });
    expect(controller.mode).toBe('three-columns');
  });

  test('falls back to two columns when three no longer fit in the window', () => {
    const controller = createController(true);

    useThreeColumns(controller);

    measure(controller, { viewportWidth: 800 });
    expect(controller.mode).toBe('description-side');

    measure(controller, { viewportWidth: 800, textColumnOverflowing: true });
    expect(controller.mode).toBe('description-side');

    measure(controller, { viewportWidth: 600 });
    expect(controller.mode).toBe('stacked');

    measure(controller, { viewportWidth: 1440 });
    expect(controller.mode).toBe('description-side');
  });

  test('does not switch layouts during small height increases while the text stack cannot fit', () => {
    const controller = createController(true);

    useThreeColumns(controller);

    for (const availableHeight of [400, 402, 404, 600, 700]) {
      measure(controller, { availableHeight, textStackHeight: 700 });
      expect(controller.mode).toBe('three-columns');
    }

    measure(controller, { availableHeight: 708, textStackHeight: 700 });
    expect(controller.mode).toBe('description-side');

    measure(controller, { availableHeight: 708, textStackHeight: 700 });
    measure(controller, { availableHeight: 708, textStackHeight: 700 });
    expect(controller.mode).toBe('description-side');
  });

  test('leaves an eight-pixel margin before returning to two columns', () => {
    const controller = createController(true);

    useThreeColumns(controller);
    measure(controller, { availableHeight: 707.9, textStackHeight: 700 });
    expect(controller.mode).toBe('three-columns');

    measure(controller, { availableHeight: 708, textStackHeight: 700 });
    expect(controller.mode).toBe('description-side');
  });

  test('returns to two columns when shorter text fits without a window resize', () => {
    const controller = createController(true);

    useThreeColumns(controller);
    measure(controller, { textStackHeight: 500 });

    expect(controller.mode).toBe('description-side');
  });

  test.each([
    { textStackHeight: Infinity, availableHeight: 600 },
    { textStackHeight: NaN, availableHeight: 600 },
    { textStackHeight: -1, availableHeight: 600 },
    { textStackHeight: 500, availableHeight: Infinity },
    { textStackHeight: 500, availableHeight: NaN },
    { textStackHeight: 500, availableHeight: -1 },
  ])(
    'ignores unavailable or invalid fit measurements: $textStackHeight / $availableHeight',
    ({ textStackHeight, availableHeight }) => {
      const controller = createController(true);

      useThreeColumns(controller);
      measure(controller, { textStackHeight, availableHeight });

      expect(controller.mode).toBe('three-columns');
    },
  );

  test('clears old text overflow when two columns now fit', () => {
    const controller = createController(true);

    measure(controller, { overflowing: true, viewportWidth: 800 });
    measure(controller, { textColumnOverflowing: true, viewportWidth: 800 });
    expect(controller.mode).toBe('description-side');

    measure(controller, { textColumnOverflowing: false, viewportWidth: 800 });
    measure(controller, { viewportWidth: 1440 });

    expect(controller.mode).toBe('description-side');
  });

  test('does not compare available height across layout modes and cause a resize loop', () => {
    const controller = createController(true);

    measure(controller, { overflowing: true, availableHeight: 2000 });

    measure(controller, {
      textColumnOverflowing: true,
      availableHeight: 300,
    });

    expect(controller.mode).toBe('three-columns');

    measure(controller, { availableHeight: 600 });
    measure(controller, { availableHeight: 600 });

    expect(controller.mode).toBe('three-columns');

    measure(controller, { availableHeight: 602, textStackHeight: 590 });
    expect(controller.mode).toBe('description-side');
  });

  test('resets both layout stages for a new attempt with content already available', () => {
    const controller = createController(true);

    useThreeColumns(controller);
    setContent(controller, { revision: 1 });
    measure(controller);

    expect(controller.mode).toBe('stacked');

    expand(controller);
    expect(controller.mode).toBe('description-side');
  });

  test.each([
    { name: 'empty content', hasContent: false, unsuccessful: false },
    { name: 'an error', hasContent: true, unsuccessful: true },
    { name: 'cancellation', hasContent: false, unsuccessful: true },
  ])('resets both layout stages for $name', ({ hasContent, unsuccessful }) => {
    const controller = createController(true);

    useThreeColumns(controller);
    setContent(controller, { hasContent, unsuccessful });

    expect(controller.mode).toBe('stacked');
    expect(controller.width).toBeUndefined();
    expect(controller.minWidth).toBeUndefined();

    setContent(controller);
    measure(controller);
    expect(controller.mode).toBe('stacked');

    expand(controller);
    expect(controller.mode).toBe('description-side');
  });

  test.each<{ width: number; expected: ModalLayoutMode }>([
    { width: 677, expected: 'stacked' },
    { width: 678, expected: 'description-side' },
    { width: 1006, expected: 'description-side' },
    { width: 1007, expected: 'three-columns' },
  ])(
    'keeps readable column widths in a $width-pixel window',
    ({ width, expected }) => {
      const controller = createController(true);

      measure(controller, { overflowing: true, viewportWidth: width });

      measure(controller, {
        textColumnOverflowing: true,
        viewportWidth: width,
      });

      expect(controller.mode).toBe(expected);
    },
  );
});
