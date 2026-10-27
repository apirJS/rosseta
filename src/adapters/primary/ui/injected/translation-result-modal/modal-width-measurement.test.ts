import { afterEach, describe, expect, test, vi } from 'vitest';
import { measureCompactModalWidth } from './modal-layout-measurement';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function createLayout(columns = 2, hasDescription = false) {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const modal = document.createElement('div');
  const sections = document.createElement('div');

  modal.className = 'modal-container';
  if (columns > 1) modal.classList.add('modal-container-columns');
  if (columns === 2 && hasDescription)
    modal.classList.add('modal-container-description-side');
  modal.style.setProperty('--translation-columns', String(columns));
  sections.className = 'translation-sections';

  sections.innerHTML =
    '<div class="translation-text-sections"><div class="section"><div class="section-header">Original</div><div class="text-box"><div class="text-content">Original text</div><div class="text-romanization">Source pronunciation</div></div></div><div class="section"><div class="section-header">Translated</div><div class="text-box"><div class="text-content">Translated text</div></div></div></div>';

  if (hasDescription) {
    sections.insertAdjacentHTML(
      'beforeend',
      '<div class="section"><div class="section-header">Description</div><div class="description-box"><div class="description-text"><p>Useful <strong>context</strong>.</p><ul><li>Visible detail</li></ul></div></div></div>',
    );
  }

  const header = document.createElement('div');
  const body = document.createElement('div');
  const footer = document.createElement('div');

  header.className = 'modal-header';
  header.textContent = 'Translation';
  body.className = 'modal-body';
  footer.className = 'modal-footer-drag';
  body.append(sections);
  modal.append(header, body, footer);
  shadow.append(modal);
  document.body.append(host);

  vi.spyOn(modal, 'getBoundingClientRect').mockReturnValue({
    width: 850,
    height: 500,
  } as DOMRect);

  vi.spyOn(sections, 'getBoundingClientRect').mockReturnValue({
    width: 816,
    height: 400,
  } as DOMRect);

  Object.defineProperty(sections, 'clientHeight', {
    configurable: true,
    value: 400,
  });

  let lastProbe: HTMLElement | undefined;
  const readProbe = vi.fn<(probe: HTMLElement) => number>(() => 530);
  const cloneNode = modal.cloneNode.bind(modal);

  const clone = vi.spyOn(modal, 'cloneNode').mockImplementation((deep) => {
    const probe = cloneNode(deep) as HTMLElement;

    lastProbe = probe;

    vi.spyOn(probe, 'getBoundingClientRect').mockImplementation(
      () => ({ height: readProbe(probe) }) as DOMRect,
    );

    return probe;
  });

  const options = {
    modal,
    sections,
    viewportWidth: 1600,
    viewportHeight: 1000,
    preferredModalWidth:
      columns === 1 ? 520 : columns * 400 + (columns - 1) * 16 + 34,
    minimumModalWidth:
      columns === 1 ? 480 : columns * 280 + (columns - 1) * 16 + 34,
  };

  return {
    ...options,
    options,
    shadow,
    clone,
    readProbe,
    get probe() {
      return lastProbe;
    },
  };
}

describe('measureCompactModalWidth', () => {
  test.each([
    { columns: 1, hasDescription: false, expected: 480 },
    { columns: 1, hasDescription: true, expected: 480 },
    { columns: 2, hasDescription: false, expected: 610 },
    { columns: 2, hasDescription: true, expected: 610 },
    { columns: 3, hasDescription: true, expected: 906 },
  ])(
    'uses the readable minimum for $columns columns with description=$hasDescription when all content fits',
    ({ columns, hasDescription, expected }) => {
      const layout = createLayout(columns, hasDescription);

      expect(measureCompactModalWidth(layout.options)).toBe(expected);
      expect(layout.modal.style.width).toBe('');
      expect(layout.probe?.isConnected).toBe(false);
    },
  );

  test('finds the smallest whole-pixel width with eight pixels of vertical headroom', () => {
    const layout = createLayout();

    layout.readProbe.mockImplementation(
      (probe) => 1560 - Number.parseFloat(probe.style.width),
    );

    expect(measureCompactModalWidth(layout.options)).toBe(668);
    expect(1560 - 668 + 8).toBe(900);
    expect(1560 - 667 + 8).toBeGreaterThan(900);
  });

  test('removes redundant width when unavoidable scrolling stays the same', () => {
    const layout = createLayout();

    layout.readProbe.mockReturnValue(1000);

    expect(measureCompactModalWidth(layout.options)).toBe(610);
    expect(layout.probe?.isConnected).toBe(false);
  });

  test('keeps the preferred width when shrinking would increase unavoidable scrolling', () => {
    const layout = createLayout();

    layout.readProbe.mockImplementation(
      (probe) => 1850 - Number.parseFloat(probe.style.width),
    );

    expect(measureCompactModalWidth(layout.options)).toBe(850);
    expect(layout.probe?.isConnected).toBe(false);
  });

  test('finds the narrowest width on an unavoidable-scroll height plateau', () => {
    const layout = createLayout();

    layout.readProbe.mockImplementation(
      (probe) => 1000 + Math.max(0, 718 - Number.parseFloat(probe.style.width)),
    );

    expect(measureCompactModalWidth(layout.options)).toBe(718);
    expect(layout.probe?.isConnected).toBe(false);
  });

  test('does not treat overflowing stacked content as extra available height', () => {
    const layout = createLayout(1, true);

    vi.mocked(layout.sections.getBoundingClientRect).mockReturnValue({
      width: 486,
      height: 1000,
    } as DOMRect);

    layout.readProbe.mockImplementation(
      (probe) => 1600 - Number.parseFloat(probe.style.width),
    );

    expect(measureCompactModalWidth(layout.options)).toBe(520);
    expect(layout.probe?.isConnected).toBe(false);
  });

  test('limits the widest candidate to ninety percent of the viewport', () => {
    const layout = createLayout();
    const measuredWidths: number[] = [];

    layout.readProbe.mockImplementation((probe) => {
      const width = Number.parseFloat(probe.style.width);

      measuredWidths.push(width);

      return 1720 - width;
    });

    expect(
      measureCompactModalWidth({ ...layout.options, viewportWidth: 800 }),
    ).toBe(720);

    expect(Math.max(...measuredWidths)).toBe(720);
  });

  test('allows a narrow viewport to constrain the automatic minimum', () => {
    const layout = createLayout(1);

    expect(
      measureCompactModalWidth({ ...layout.options, viewportWidth: 300 }),
    ).toBe(270);
  });

  test('leaves native width and height untouched after user resizing', () => {
    const layout = createLayout();

    layout.modal.style.width = '950px';
    layout.modal.style.height = '650px';

    expect(measureCompactModalWidth(layout.options)).toBeUndefined();
    expect(layout.modal.style.width).toBe('950px');
    expect(layout.modal.style.height).toBe('650px');
    expect(layout.clone).not.toHaveBeenCalled();
  });

  test('uses the actual modal height as the budget for a manually sized modal', () => {
    const layout = createLayout();

    layout.readProbe.mockImplementation(
      (probe) => 1234 - Number.parseFloat(probe.style.width),
    );

    expect(measureCompactModalWidth(layout.options)).toBe(610);

    layout.modal.style.height = '500px';

    expect(measureCompactModalWidth(layout.options)).toBe(742);
    expect(layout.modal.style.height).toBe('500px');
    expect(layout.modal.style.width).toBe('');
  });

  test('measures romanization and rendered Markdown together without altering live content', () => {
    const layout = createLayout(3, true);
    const originalMarkup = layout.sections.outerHTML;

    layout.readProbe.mockImplementation((probe) => {
      expect(probe.parentNode).toBe(layout.modal.parentNode);
      expect(probe.getRootNode()).toBe(layout.shadow);
      expect(probe.getAttribute('aria-hidden')).toBe('true');
      expect(probe.hasAttribute('inert')).toBe(true);
      expect(probe.style.position).toBe('fixed');
      expect(probe.style.visibility).toBe('hidden');
      expect(probe.style.pointerEvents).toBe('none');
      expect(probe.style.height).toBe('auto');
      expect(probe.style.minHeight).toBe('0px');
      expect(probe.style.maxHeight).toBe('none');
      expect(probe.style.overflow).toBe('visible');

      expect(probe.querySelector('.modal-header')?.textContent).toBe(
        'Translation',
      );

      expect(probe.querySelector('.modal-footer-drag')).not.toBeNull();
      expect(probe.querySelectorAll('.section')).toHaveLength(3);

      expect(probe.querySelector('.text-romanization')?.textContent).toBe(
        'Source pronunciation',
      );

      expect(probe.querySelector('.description-text strong')?.textContent).toBe(
        'context',
      );

      expect(probe.querySelector('.description-text li')?.textContent).toBe(
        'Visible detail',
      );

      return 530;
    });

    expect(measureCompactModalWidth(layout.options)).toBe(906);
    expect(layout.sections.outerHTML).toBe(originalMarkup);
    expect(layout.probe?.isConnected).toBe(false);
  });

  test('removes the hidden clone when measuring throws', () => {
    const layout = createLayout();
    const originalMarkup = layout.sections.outerHTML;

    layout.readProbe.mockImplementation(() => {
      throw new Error('Size unavailable');
    });

    expect(() => measureCompactModalWidth(layout.options)).toThrow(
      'Size unavailable',
    );

    expect(layout.sections.outerHTML).toBe(originalMarkup);
    expect(layout.probe?.isConnected).toBe(false);
  });

  test.each([
    { viewportWidth: 0 },
    { viewportHeight: Number.NaN },
    { preferredModalWidth: Number.NaN },
    { minimumModalWidth: 0 },
    { viewportHeight: 0 },
  ])('does not guess when required geometry is invalid: %j', (overrides) => {
    const layout = createLayout();

    expect(
      measureCompactModalWidth({ ...layout.options, ...overrides }),
    ).toBeUndefined();

    expect(layout.clone).not.toHaveBeenCalled();
  });

  test('does not guess when the modal has no measurable size', () => {
    const layout = createLayout();

    vi.mocked(layout.modal.getBoundingClientRect).mockReturnValue({
      width: 0,
      height: 0,
    } as DOMRect);

    expect(measureCompactModalWidth(layout.options)).toBeUndefined();
    expect(layout.clone).not.toHaveBeenCalled();
  });

  test('does not insert a probe for a detached modal', () => {
    const layout = createLayout();

    layout.modal.remove();

    expect(measureCompactModalWidth(layout.options)).toBeUndefined();
    expect(layout.clone).not.toHaveBeenCalled();
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -1])(
    'returns no width and removes the clone when its height is unusable: %s',
    (height) => {
      const layout = createLayout();
      const originalMarkup = layout.sections.outerHTML;

      layout.readProbe.mockReturnValue(height);

      expect(measureCompactModalWidth(layout.options)).toBeUndefined();
      expect(layout.sections.outerHTML).toBe(originalMarkup);
      expect(layout.probe?.isConnected).toBe(false);
    },
  );

  test('abandons compaction if a later search measurement becomes unavailable', () => {
    const layout = createLayout();

    layout.readProbe.mockReturnValueOnce(530).mockReturnValue(Number.NaN);

    expect(measureCompactModalWidth(layout.options)).toBeUndefined();
    expect(layout.readProbe).toHaveBeenCalledTimes(2);
    expect(layout.probe?.isConnected).toBe(false);
  });
});
