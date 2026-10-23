import { afterEach, describe, expect, test, vi } from 'vitest';
import { measureDescriptionLayout } from './modal-layout-measurement';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function createLayout() {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const modal = document.createElement('div');
  const sections = document.createElement('div');
  const textColumn = document.createElement('div');

  sections.style.columnGap = '16px';
  textColumn.className = 'translation-text-sections';

  textColumn.innerHTML =
    '<div class="section"><div class="text-box"><div class="text-content">Original</div><div class="text-romanization">Reading</div></div></div><div class="section"><div class="text-box">Translated</div></div>';

  sections.append(textColumn);
  modal.append(sections);
  shadow.append(modal);
  document.body.append(host);

  vi.spyOn(modal, 'getBoundingClientRect').mockReturnValue({
    width: 1266,
    height: 500,
  } as DOMRect);

  vi.spyOn(sections, 'getBoundingClientRect').mockReturnValue({
    width: 1232,
    height: 400,
  } as DOMRect);

  Object.defineProperty(sections, 'clientHeight', {
    configurable: true,
    value: 400,
  });

  let lastProbe: HTMLElement | undefined;
  const readProbe = vi.fn<(probe: HTMLElement) => number>(() => 530);
  const cloneNode = textColumn.cloneNode.bind(textColumn);

  const clone = vi.spyOn(textColumn, 'cloneNode').mockImplementation((deep) => {
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
    textColumn,
    viewportWidth: 1600,
    viewportHeight: 1000,
    preferredModalWidth: 850,
    minimumModalWidth: 610,
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

describe('measureDescriptionLayout', () => {
  test('measures at the proposed two-column width instead of the visible three-column width', () => {
    const layout = createLayout();

    layout.readProbe.mockImplementation((probe) => {
      expect(probe.style.width).toBe('400px');

      return 530.5;
    });

    expect(measureDescriptionLayout(layout.options)).toEqual({
      textStackHeight: 530.5,
      availableHeight: 750,
    });
  });

  test('limits the proposed automatic width to the viewport', () => {
    const layout = createLayout();

    layout.readProbe.mockImplementation((probe) => {
      expect(probe.style.width).toBe('335px');

      return 600;
    });

    measureDescriptionLayout({ ...layout.options, viewportWidth: 800 });
  });

  test.each([
    { requested: '700px', columnWidth: '325px' },
    { requested: '500px', columnWidth: '280px' },
  ])(
    'measures native width $requested under the two-column minimum',
    ({ requested, columnWidth }) => {
      const layout = createLayout();

      layout.modal.style.width = requested;

      vi.mocked(layout.modal.getBoundingClientRect).mockReturnValue({
        width: 906,
        height: 500,
      } as DOMRect);

      vi.mocked(layout.sections.getBoundingClientRect).mockReturnValue({
        width: 872,
        height: 400,
      } as DOMRect);

      layout.readProbe.mockImplementation((probe) => {
        expect(probe.style.width).toBe(columnWidth);

        return 300;
      });

      measureDescriptionLayout(layout.options);
      expect(layout.modal.style.width).toBe(requested);
    },
  );

  test('constrains the requested native width by the two-column CSS maximum', () => {
    const layout = createLayout();

    layout.modal.style.width = '2000px';

    layout.readProbe.mockImplementation((probe) => {
      expect(probe.style.width).toBe('515px');

      return 300;
    });

    measureDescriptionLayout({ ...layout.options, viewportWidth: 1200 });

    expect(layout.modal.style.width).toBe('2000px');
  });

  test('does not guess a candidate width for unsupported inline units', () => {
    const layout = createLayout();

    layout.modal.style.width = '80%';

    expect(measureDescriptionLayout(layout.options)).toEqual({
      textStackHeight: Number.POSITIVE_INFINITY,
      availableHeight: 0,
    });

    expect(layout.clone).not.toHaveBeenCalled();
  });

  test('lets the two-column minimum win when the viewport maximum is smaller', () => {
    const layout = createLayout();

    layout.readProbe.mockImplementation((probe) => {
      expect(probe.style.width).toBe('280px');

      return 300;
    });

    measureDescriptionLayout({ ...layout.options, viewportWidth: 600 });
  });

  test('uses the viewport height for automatic sizing and the actual body height for manual sizing', () => {
    const layout = createLayout();

    expect(measureDescriptionLayout(layout.options).availableHeight).toBe(750);

    layout.modal.style.height = '500px';

    expect(measureDescriptionLayout(layout.options).availableHeight).toBe(400);
    expect(layout.modal.style.height).toBe('500px');
  });

  test('keeps the hidden clone in the same shadow tree and leaves live content and styles untouched', () => {
    const layout = createLayout();

    layout.textColumn.style.height = '400px';

    const originalMarkup = layout.textColumn.outerHTML;

    layout.readProbe.mockImplementation((probe) => {
      expect(probe.parentElement).toBe(layout.sections);
      expect(probe.getRootNode()).toBe(layout.shadow);
      expect(probe.getAttribute('aria-hidden')).toBe('true');
      expect(probe.hasAttribute('inert')).toBe(true);
      expect(probe.style.position).toBe('fixed');
      expect(probe.style.visibility).toBe('hidden');
      expect(probe.style.pointerEvents).toBe('none');
      expect(probe.style.display).toBe('flex');
      expect(probe.style.flexDirection).toBe('column');
      expect(probe.style.height).toBe('auto');
      expect(probe.style.minHeight).toBe('0px');
      expect(probe.style.maxHeight).toBe('none');
      expect(probe.style.overflow).toBe('visible');
      expect(probe.children).toHaveLength(2);

      expect(probe.querySelector('.text-romanization')?.textContent).toBe(
        'Reading',
      );

      return 530;
    });

    measureDescriptionLayout(layout.options);

    expect(layout.textColumn.outerHTML).toBe(originalMarkup);
    expect(layout.sections.children).toHaveLength(1);
    expect(layout.probe?.isConnected).toBe(false);
  });

  test('removes the probe even if reading its size fails', () => {
    const layout = createLayout();

    layout.readProbe.mockImplementation(() => {
      throw new Error('Size unavailable');
    });

    expect(() => measureDescriptionLayout(layout.options)).toThrow(
      'Size unavailable',
    );

    expect(layout.sections.children).toHaveLength(1);
    expect(layout.probe?.isConnected).toBe(false);
  });

  test.each([
    { viewportWidth: 0 },
    { viewportHeight: Number.NaN },
    { preferredModalWidth: Number.NaN },
    { viewportHeight: 100 },
  ])('does not guess when geometry is unavailable: %j', (overrides) => {
    const layout = createLayout();

    expect(
      measureDescriptionLayout({ ...layout.options, ...overrides }),
    ).toEqual({
      textStackHeight: Number.POSITIVE_INFINITY,
      availableHeight: 0,
    });

    expect(layout.clone).not.toHaveBeenCalled();
  });

  test('returns a conservative measurement if the probe has no usable height', () => {
    const layout = createLayout();

    layout.readProbe.mockReturnValue(Number.NaN);

    expect(measureDescriptionLayout(layout.options)).toEqual({
      textStackHeight: Number.POSITIVE_INFINITY,
      availableHeight: 0,
    });

    expect(layout.probe?.isConnected).toBe(false);
  });
});
