function freezeSiblingSections(currentSection: HTMLElement): () => void {
  const parent = currentSection.parentElement;
  if (!parent) return () => {};

  const siblings = Array.from(
    parent.querySelectorAll(':scope > .section'),
  ).filter((el): el is HTMLElement => el !== currentSection);

  const saved = siblings.map((el) => ({
    el,
    flex: el.style.flex,
    height: el.style.height,
    minHeight: el.style.minHeight,
  }));

  for (const sib of siblings) {
    const h = sib.getBoundingClientRect().height;
    sib.style.height = `${h}px`;
    sib.style.flex = 'none';
    sib.style.minHeight = '0';
  }

  return () => {
    for (const { el, flex, height, minHeight } of saved) {
      el.style.flex = flex;
      el.style.height = height;
      el.style.minHeight = minHeight;
    }
  };
}

export function startSectionResize(options: {
  event: PointerEvent;
  box: HTMLElement;
  minHeight: number;
  onEnd?: () => void;
}): void {
  const { event, box, minHeight, onEnd } = options;
  const handle = event.currentTarget as HTMLElement;
  handle.setPointerCapture(event.pointerId);

  const startY = event.clientY;
  const startHeight = box.getBoundingClientRect().height;
  const section = box.closest('.section') as HTMLElement | null;

  const unfreezeSiblings = section
    ? freezeSiblingSections(section)
    : () => {};

  const onMove = (e: PointerEvent) => {
    const delta = e.clientY - startY;
    const newHeight = Math.max(minHeight, startHeight + delta);
    box.style.height = `${newHeight}px`;
    box.style.flex = 'none';
    if (section) {
      section.style.flex = 'none';
      section.style.minHeight = '0';
    }
  };

  const onUp = (e: PointerEvent) => {
    handle.releasePointerCapture(e.pointerId);
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    unfreezeSiblings();
    onEnd?.();
  };

  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
}
