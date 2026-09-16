import type { Action } from 'svelte/action';

export const clickOutside: Action<HTMLElement, () => void> = (
  node,
  callback,
) => {
  let cb = callback;

  function handlePointerDown(e: PointerEvent) {
    if (!node.contains(e.target as Node)) cb();
  }

  document.addEventListener('pointerdown', handlePointerDown);

  return {
    update(next: () => void) {
      cb = next;
    },
    destroy() {
      document.removeEventListener('pointerdown', handlePointerDown);
    },
  };
};
