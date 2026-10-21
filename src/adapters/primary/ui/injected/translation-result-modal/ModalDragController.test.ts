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
