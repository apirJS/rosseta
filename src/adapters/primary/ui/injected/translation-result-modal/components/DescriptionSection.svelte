<script lang="ts">
  interface Props {
    text: string;
  }

  const { text }: Props = $props();

  let descBoxEl: HTMLDivElement;

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

  function handleResizePointerDown(e: PointerEvent) {
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);

    const startY = e.clientY;
    const startHeight = descBoxEl.getBoundingClientRect().height;
    const section = descBoxEl.closest('.section') as HTMLElement | null;

    const unfreezeSiblings = section
      ? freezeSiblingSections(section)
      : () => {};

    const onMove = (e: PointerEvent) => {
      const delta = e.clientY - startY;
      const newHeight = Math.max(40, startHeight + delta);
      descBoxEl.style.height = `${newHeight}px`;
      descBoxEl.style.flex = 'none';
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
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  }
</script>

<div class="description-box" bind:this={descBoxEl}>
  <p class="description-text">{text}</p>
</div>
<button
  type="button"
  class="resize-handle"
  aria-label="Resize description section"
  onpointerdown={handleResizePointerDown}
></button>
