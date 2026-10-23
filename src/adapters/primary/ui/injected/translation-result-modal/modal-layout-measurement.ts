interface DescriptionLayoutOptions {
  modal: HTMLElement;
  sections: HTMLElement;
  textColumn: HTMLElement;
  viewportWidth: number;
  viewportHeight: number;
  preferredModalWidth: number;
  minimumModalWidth: number;
}

interface DescriptionLayoutMeasurement {
  textStackHeight: number;
  availableHeight: number;
}

const UNAVAILABLE_MEASUREMENT: DescriptionLayoutMeasurement = {
  textStackHeight: Number.POSITIVE_INFINITY,
  availableHeight: 0,
};

function positiveFinite(...values: number[]): boolean {
  return values.every((value) => Number.isFinite(value) && value > 0);
}

/** Measures the two-column layout without changing the visible layout. */
export function measureDescriptionLayout({
  modal,
  sections,
  textColumn,
  viewportWidth,
  viewportHeight,
  preferredModalWidth,
  minimumModalWidth,
}: DescriptionLayoutOptions): DescriptionLayoutMeasurement {
  const modalRect = modal.getBoundingClientRect();
  const sectionsRect = sections.getBoundingClientRect();

  if (
    !positiveFinite(
      viewportWidth,
      viewportHeight,
      minimumModalWidth,
      modalRect.width,
      modalRect.height,
      sectionsRect.width,
      sectionsRect.height,
    )
  ) {
    return UNAVAILABLE_MEASUREMENT;
  }

  // The current three-column minimum can make the modal wider than the user's
  // requested size. Measure the width it would have under two-column limits.
  const nativeWidth = modal.style.width;

  const requestedWidth = nativeWidth
    ? nativeWidth.endsWith('px')
      ? Number(nativeWidth.slice(0, -2))
      : Number.NaN
    : preferredModalWidth;

  if (!Number.isFinite(requestedWidth) || requestedWidth < 0) {
    return UNAVAILABLE_MEASUREMENT;
  }

  const modalWidth = Math.max(
    minimumModalWidth,
    Math.min(requestedWidth, viewportWidth * 0.9),
  );

  const computedGap =
    sections.ownerDocument.defaultView?.getComputedStyle(sections).columnGap;

  const columnGap =
    computedGap === 'normal' ? 0 : Number.parseFloat(computedGap ?? '');

  const columnWidth =
    (modalWidth - (modalRect.width - sectionsRect.width) - columnGap) / 2;

  const availableHeight = modal.style.height
    ? sections.clientHeight
    : Math.max(
        0,
        viewportHeight * 0.85 - (modalRect.height - sectionsRect.height),
      );

  if (!positiveFinite(columnWidth, availableHeight)) {
    return UNAVAILABLE_MEASUREMENT;
  }

  const probe = textColumn.cloneNode(true) as HTMLElement;

  probe.setAttribute('aria-hidden', 'true');
  probe.setAttribute('inert', '');

  Object.assign(probe.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    display: 'flex',
    flexDirection: 'column',
    visibility: 'hidden',
    pointerEvents: 'none',
    width: `${columnWidth}px`,
    height: 'auto',
    minHeight: '0',
    maxHeight: 'none',
    overflow: 'visible',
    flex: 'none',
  });

  try {
    // Keep the clone in the same shadow tree so it receives the real text styles.
    sections.append(probe);

    const textStackHeight = probe.getBoundingClientRect().height;

    return positiveFinite(textStackHeight)
      ? { textStackHeight, availableHeight }
      : UNAVAILABLE_MEASUREMENT;
  } finally {
    probe.remove();
  }
}
