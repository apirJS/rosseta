interface ModalMeasurementOptions {
  modal: HTMLElement;
  sections: HTMLElement;
  viewportWidth: number;
  viewportHeight: number;
  preferredModalWidth: number;
  minimumModalWidth: number;
}

interface DescriptionLayoutOptions extends ModalMeasurementOptions {
  textColumn: HTMLElement;
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

/** Finds the narrowest automatic width whose natural content fits vertically. */
export function measureCompactModalWidth({
  modal,
  viewportWidth,
  viewportHeight,
  preferredModalWidth,
  minimumModalWidth,
}: ModalMeasurementOptions): number | undefined {
  // Native resizing owns inline dimensions; automatic sizing only supplies CSS defaults.
  if (modal.style.width) return undefined;

  const modalRect = modal.getBoundingClientRect();

  if (
    !positiveFinite(
      viewportWidth,
      viewportHeight,
      preferredModalWidth,
      minimumModalWidth,
      modalRect.width,
      modalRect.height,
    )
  )
    return undefined;

  const availableHeight = modal.style.height
    ? modalRect.height
    : viewportHeight * 0.9;

  let upper = Math.floor(Math.min(preferredModalWidth, viewportWidth * 0.9));
  let lower = Math.min(Math.ceil(minimumModalWidth), upper);

  if (!positiveFinite(availableHeight, lower, upper) || !modal.parentNode)
    return undefined;

  const probe = modal.cloneNode(true) as HTMLElement;

  probe.setAttribute('aria-hidden', 'true');
  probe.setAttribute('inert', '');

  Object.assign(probe.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    height: 'auto',
    minHeight: '0',
    maxHeight: 'none',
    overflow: 'visible',
    flex: 'none',
    transform: 'none',
    resize: 'none',
  });

  const naturalHeight = (width: number): number => {
    probe.style.width = `${width}px`;

    return probe.getBoundingClientRect().height;
  };

  try {
    modal.parentNode.appendChild(probe);

    const upperHeight = naturalHeight(upper);

    if (!positiveFinite(upperHeight)) return undefined;

    // If scrolling is unavoidable, remove width that does not reduce it.
    const heightLimit = Math.max(availableHeight - 8, upperHeight);

    while (lower < upper) {
      const middle = Math.floor((lower + upper) / 2);
      const middleHeight = naturalHeight(middle);

      if (!positiveFinite(middleHeight)) return undefined;
      if (middleHeight <= heightLimit) upper = middle;
      else lower = middle + 1;
    }

    return upper;
  } finally {
    probe.remove();
  }
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
        viewportHeight * 0.9 - (modalRect.height - sectionsRect.height),
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
