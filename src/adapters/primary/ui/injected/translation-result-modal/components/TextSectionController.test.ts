import { describe, expect, test, vi } from 'vitest';
import type { IndexedSegmentPayload } from '../translation-modal-segments';
import { TextSectionController } from './TextSectionController';

function pointerAt(index: string | undefined): PointerEvent {
  const segment = document.createElement('span');
  const child = document.createElement('b');

  if (index !== undefined) segment.dataset.segIndex = index;
  segment.append(child);

  return { target: child } as unknown as PointerEvent;
}

describe('text section interactions', () => {
  test('finds the segment beneath nested content and clears hover on leave', () => {
    const onSegmentIndexHover = vi.fn();

    const controller = new TextSectionController(() => ({
      blocks: [],
      onSegmentIndexHover,
    }));

    controller.handleSegmentPointer(pointerAt('4'));
    expect(onSegmentIndexHover).toHaveBeenLastCalledWith(4);
    controller.handleSegmentLeave();
    expect(onSegmentIndexHover).toHaveBeenLastCalledWith(null);
  });

  test.each([undefined, 'invalid', '-1', '1.5'])(
    'ignores targets without a valid segment index: %s',
    (index) => {
      const onSegmentIndexHover = vi.fn();

      const controller = new TextSectionController(() => ({
        blocks: [],
        onSegmentIndexHover,
      }));

      controller.handleSegmentPointer(pointerAt(index));
      controller.handleSegmentPointer({ target: null } as PointerEvent);
      expect(onSegmentIndexHover).not.toHaveBeenCalled();
    },
  );

  test('clears the current highlight and suppresses pointer updates during resize', () => {
    const onSegmentIndexHover = vi.fn();

    const controller = new TextSectionController(() => ({
      blocks: [],
      onSegmentIndexHover,
    }));

    controller.startResize();
    expect(onSegmentIndexHover).toHaveBeenLastCalledWith(null);
    onSegmentIndexHover.mockClear();
    controller.handleSegmentPointer(pointerAt('1'));
    controller.handleSegmentLeave();
    expect(onSegmentIndexHover).not.toHaveBeenCalled();
    controller.endResize();
    controller.handleSegmentPointer(pointerAt('1'));
    expect(onSegmentIndexHover).toHaveBeenLastCalledWith(1);
  });

  test('reads current blocks and callbacks without replacing the controller', () => {
    const segment: IndexedSegmentPayload = {
      index: 0,
      blockIndex: 0,
      text: 'Source',
      romanization: null,
      language: { code: 'ja-JP', name: 'Japanese' },
    };

    let blocks = [[segment]];
    let onSegmentIndexHover = vi.fn();

    const controller = new TextSectionController(() => ({
      blocks,
      onSegmentIndexHover,
    }));

    expect(controller.romanizedBlocks).toEqual([]);
    blocks = [[segment], [{ ...segment, index: 1, romanization: 'Source' }]];
    expect(controller.romanizedBlocks).toEqual([blocks[1]]);
    onSegmentIndexHover = vi.fn();
    controller.handleSegmentPointer(pointerAt('1'));
    expect(onSegmentIndexHover).toHaveBeenCalledWith(1);
  });
});
