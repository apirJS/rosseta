import { afterEach, describe, expect, test } from 'vitest';
import { ModalDragController } from './ModalDragController.svelte';

const controllers: ModalDragController[] = [];

function createController(): ModalDragController {
  const controller = new ModalDragController();

  controllers.push(controller);

  return controller;
}

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
});

describe('ModalDragController', () => {
  test.each([
    {
      name: 'leaves an onscreen modal in place',
      left: 100,
      top: 100,
      width: 300,
      height: 200,
      position: [40, -20],
    },
    {
      name: 'moves an expanded modal away from the right and bottom edges',
      left: 600,
      top: 400,
      width: 300,
      height: 300,
      position: [-60, -120],
    },
    {
      name: 'moves a modal away from the left and top edges',
      left: -60,
      top: -30,
      width: 300,
      height: 200,
      position: [100, 10],
    },
    {
      name: 'keeps the top left accessible when the modal exceeds the viewport',
      left: -100,
      top: 50,
      width: 900,
      height: 700,
      position: [140, -70],
    },
  ])('$name', ({ left, top, width, height, position }) => {
    const controller = createController();

    controller.x = 40;
    controller.y = -20;

    controller.constrainToViewport(
      {
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
      },
      { width: 800, height: 600 },
    );

    expect([controller.x, controller.y]).toEqual(position);
  });

  test('does not constrain position after disposal', () => {
    const controller = createController();

    controller.x = 40;
    controller.y = -20;
    controller.dispose();

    controller.constrainToViewport(
      {
        left: -60,
        top: -30,
        right: 240,
        bottom: 170,
        width: 300,
        height: 200,
      },
      { width: 800, height: 600 },
    );

    expect([controller.x, controller.y]).toEqual([40, -20]);
  });

  test('moving preserves the pointer offset across successive drags', () => {
    const controller = createController();

    controller.start({ button: 0, clientX: 10, clientY: 20 } as PointerEvent);

    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 30, clientY: 50 }),
    );

    expect([controller.x, controller.y]).toEqual([20, 30]);
    window.dispatchEvent(new Event('pointerup'));

    controller.start({ button: 0, clientX: 25, clientY: 35 } as PointerEvent);

    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 40, clientY: 45 }),
    );

    expect([controller.x, controller.y]).toEqual([35, 40]);
  });

  test.each(['pointerup', 'pointercancel'])('%s stops movement', (event) => {
    const controller = createController();

    controller.start({ button: 0, clientX: 0, clientY: 0 } as PointerEvent);
    window.dispatchEvent(new Event(event));

    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 50, clientY: 50 }),
    );

    expect([controller.x, controller.y]).toEqual([0, 0]);
  });

  test('ignores secondary buttons and cannot restart after disposal', () => {
    const controller = createController();

    controller.start({ button: 2, clientX: 0, clientY: 0 } as PointerEvent);

    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 20, clientY: 20 }),
    );

    controller.dispose();
    controller.start({ button: 0, clientX: 0, clientY: 0 } as PointerEvent);

    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 50, clientY: 50 }),
    );

    expect([controller.x, controller.y]).toEqual([0, 0]);
  });
});
