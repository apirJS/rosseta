import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import TranslationModal from './TranslationModal.svelte';
import { TranslationModalController } from './TranslationModalController.svelte';
import {
  measureCompactModalWidth,
  measureDescriptionLayout,
} from './modal-layout-measurement';

vi.mock('./modal-layout-measurement', () => ({
  measureCompactModalWidth: vi.fn(),
  measureDescriptionLayout: vi.fn(),
}));

const resizeCallbacks = new Set<() => void>();
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;

beforeEach(() => {
  vi.stubGlobal('innerWidth', 1440);
  vi.mocked(measureCompactModalWidth).mockReturnValue(undefined);

  vi.mocked(measureDescriptionLayout).mockImplementation(
    ({ sections, textColumn }) => ({
      textStackHeight: textColumn.scrollHeight,
      availableHeight: sections.clientHeight,
    }),
  );

  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}

      observe() {
        resizeCallbacks.add(this.callback);
      }

      disconnect() {
        resizeCallbacks.delete(this.callback);
      }
    },
  );

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);

    return nextFrame;
  });

  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resizeCallbacks.clear();
  frames.clear();
});

function flushLayoutFrame() {
  flushSync();

  const pending = [...frames.values()];

  frames.clear();
  flushSync(() => pending.forEach((callback) => callback(0)));
}

function flushLayout() {
  flushSync();

  for (let count = 0; frames.size > 0; count++) {
    if (count > 10) throw new Error('Modal layout did not settle');
    flushLayoutFrame();
  }
}

function mountOverflowingResult(description = '') {
  const segment = {
    text: 'Visible text',
    language: { code: 'en-US', name: 'English' },
    romanization: null,
    blockIndex: 0,
  };

  const controller = new TranslationModalController({
    original: [segment],
    translated: [segment],
    description,
    detachModal: vi.fn(),
  });

  const rendered = render(TranslationModal, { controller });
  const dialog = rendered.getByRole('dialog');
  const body = rendered.container.querySelector<HTMLElement>('.modal-body')!;

  const sections = rendered.container.querySelector<HTMLElement>(
    '.translation-sections',
  )!;

  const textColumn = rendered.container.querySelector<HTMLElement>(
    '.translation-text-sections',
  )!;

  let contentHeight = 800;
  let textColumnContentHeight = 300;
  let availableHeight = 400;

  Object.defineProperties(body, {
    clientHeight: { configurable: true, value: 400 },
    scrollHeight: { configurable: true, get: () => contentHeight },
  });

  Object.defineProperty(sections, 'clientHeight', {
    configurable: true,
    get: () => availableHeight,
  });

  Object.defineProperties(textColumn, {
    clientHeight: { configurable: true, get: () => availableHeight },
    scrollHeight: { configurable: true, get: () => textColumnContentHeight },
  });

  return {
    ...rendered,
    controller,
    dialog,
    body,
    textColumn,
    setContentHeight: (height: number) => (contentHeight = height),
    setTextColumnContentHeight: (height: number) =>
      (textColumnContentHeight = height),
    setAvailableHeight: (height: number) => (availableHeight = height),
  };
}

describe('UI: adaptive translation layout', () => {
  test.each(['', 'Useful context'])(
    'compacts a short result with description %j',
    (description) => {
      const { controller, dialog, setContentHeight } =
        mountOverflowingResult(description);

      setContentHeight(400);
      vi.mocked(measureCompactModalWidth).mockReturnValue(320);
      flushLayout();

      expect(dialog.style.getPropertyValue('--modal-preferred-width')).toBe(
        '320px',
      );

      expect(dialog.style.getPropertyValue('--translation-columns')).toBe('1');

      // Streaming or wrapping can require more room without changing modes.
      vi.mocked(measureCompactModalWidth).mockReturnValue(410);
      resizeCallbacks.forEach((callback) => callback());
      flushLayout();

      expect(dialog.style.getPropertyValue('--modal-preferred-width')).toBe(
        '410px',
      );

      expect(dialog.style.width).toBe('');
      expect(dialog.style.height).toBe('');
      controller.dispose();
    },
  );

  test('waits for the fitted width to reflow before deciding to add columns', () => {
    const { controller, dialog, setContentHeight } =
      mountOverflowingResult('Useful context');

    vi.mocked(measureCompactModalWidth).mockReturnValue(500);
    flushLayoutFrame();
    expect(dialog.style.getPropertyValue('--translation-columns')).toBe('1');

    setContentHeight(400);
    flushLayout();
    expect(dialog.style.getPropertyValue('--translation-columns')).toBe('1');
    controller.dispose();
  });

  test.each([
    { description: '', columns: 2 },
    { description: 'Useful context', columns: 2 },
  ])(
    'uses $columns columns when the stacked body overflows',
    ({ description, columns }) => {
      const { container, controller, dialog, body, setContentHeight } =
        mountOverflowingResult(description);

      const boxes = [
        ...container.querySelectorAll('.text-box, .description-box'),
      ];

      body.scrollTop = 180;
      flushLayout();
      expect(dialog.classList.contains('modal-container-columns')).toBe(true);

      expect(
        dialog.classList.contains('modal-container-description-side'),
      ).toBe(!!description);

      expect(dialog.style.getPropertyValue('--translation-columns')).toBe(
        String(columns),
      );

      expect(body.scrollTop).toBe(0);

      expect([
        ...container.querySelectorAll('.text-box, .description-box'),
      ]).toEqual(boxes);

      // A successful reflow must not immediately switch back to the stacked layout.
      setContentHeight(400);
      resizeCallbacks.forEach((callback) => callback());
      flushLayout();
      expect(dialog.classList.contains('modal-container-columns')).toBe(true);

      // Native resizing should survive ordinary streaming/content updates.
      dialog.style.width = '950px';
      flushSync(() => controller.started({ code: 'en-US', name: 'English' }));
      resizeCallbacks.forEach((callback) => callback());
      flushLayout();
      expect(dialog.style.width).toBe('950px');
      controller.dispose();
    },
  );

  test('tries description beside the text before promoting the rendered left column', () => {
    const { controller, dialog, setTextColumnContentHeight } =
      mountOverflowingResult('Useful context');

    setTextColumnContentHeight(800);
    flushLayoutFrame();
    expect(dialog.style.getPropertyValue('--translation-columns')).toBe('2');

    expect(dialog.classList.contains('modal-container-description-side')).toBe(
      true,
    );

    flushLayout();
    expect(dialog.style.getPropertyValue('--translation-columns')).toBe('3');

    expect(dialog.classList.contains('modal-container-description-side')).toBe(
      false,
    );

    controller.dispose();
  });

  test('a long description does not force the text into three columns', () => {
    const { controller, dialog } = mountOverflowingResult(
      'Long description'.repeat(1000),
    );

    const descriptionBox = dialog.querySelector('.description-box')!;

    Object.defineProperties(descriptionBox, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 20000 },
    });

    flushLayout();
    expect(dialog.style.getPropertyValue('--translation-columns')).toBe('2');

    expect(dialog.classList.contains('modal-container-description-side')).toBe(
      true,
    );

    controller.dispose();
  });

  test('remeasures streaming text and tries a two-column layout when description arrives', () => {
    const { controller, dialog, setContentHeight, setTextColumnContentHeight } =
      mountOverflowingResult();

    setContentHeight(400);
    flushLayout();
    expect(dialog.classList.contains('modal-container-columns')).toBe(false);

    const snapshot = (description: string | null) => {
      controller.snapshot({
        segments: [
          {
            index: 0,
            blockIndex: 0,
            originalText: 'Longer source text',
            translatedText: 'Longer translated text',
            sourceLanguageCode: 'en-US',
            romanization: null,
          },
        ],
        description,
      });
    };

    setContentHeight(800);

    flushSync(() => {
      controller.started({ code: 'en-US', name: 'English' });
      snapshot(null);
    });

    // No resize event: the content update itself must schedule a measurement.
    flushLayout();
    expect(dialog.style.getPropertyValue('--translation-columns')).toBe('2');

    flushSync(() => snapshot('New description'));
    flushLayout();
    expect(dialog.style.getPropertyValue('--translation-columns')).toBe('2');

    expect(dialog.classList.contains('modal-container-description-side')).toBe(
      true,
    );

    setTextColumnContentHeight(800);
    resizeCallbacks.forEach((callback) => callback());
    flushLayout();
    expect(dialog.style.getPropertyValue('--translation-columns')).toBe('3');
    expect(dialog.querySelectorAll('.section')).toHaveLength(3);
    controller.dispose();
  });

  test('keeps narrow windows stacked and restores columns when space returns', () => {
    vi.stubGlobal('innerWidth', 600);

    const { controller, dialog } = mountOverflowingResult('Description');

    flushLayout();
    expect(dialog.classList.contains('modal-container-columns')).toBe(false);

    vi.stubGlobal('innerWidth', 1440);
    window.dispatchEvent(new Event('resize'));
    flushLayout();
    expect(dialog.style.getPropertyValue('--translation-columns')).toBe('2');

    expect(dialog.classList.contains('modal-container-description-side')).toBe(
      true,
    );

    vi.stubGlobal('innerWidth', 600);
    window.dispatchEvent(new Event('resize'));
    flushLayout();
    expect(dialog.classList.contains('modal-container-columns')).toBe(false);
    expect(dialog.style.width).toBe('');
    controller.dispose();
  });

  test('keeps the left column scrollable when three readable columns cannot fit', () => {
    vi.stubGlobal('innerWidth', 800);

    const { controller, dialog, textColumn, setTextColumnContentHeight } =
      mountOverflowingResult('Description');

    setTextColumnContentHeight(800);
    flushLayout();
    expect(dialog.style.getPropertyValue('--translation-columns')).toBe('2');

    expect(dialog.classList.contains('modal-container-description-side')).toBe(
      true,
    );

    expect(textColumn.scrollHeight).toBeGreaterThan(textColumn.clientHeight);
    controller.dispose();
  });

  test('returns to description beside the text when more vertical space becomes available', () => {
    const {
      controller,
      dialog,
      setTextColumnContentHeight,
      setAvailableHeight,
    } = mountOverflowingResult('Description');

    setTextColumnContentHeight(600);
    flushLayout();
    expect(dialog.style.getPropertyValue('--translation-columns')).toBe('3');

    setAvailableHeight(700);
    resizeCallbacks.forEach((callback) => callback());
    flushLayout();
    expect(dialog.style.getPropertyValue('--translation-columns')).toBe('2');

    expect(dialog.classList.contains('modal-container-description-side')).toBe(
      true,
    );

    controller.dispose();
  });

  test('resizing three columns never visibly retries a layout that still cannot fit', () => {
    const {
      controller,
      dialog,
      setTextColumnContentHeight,
      setAvailableHeight,
    } = mountOverflowingResult('Description');

    setTextColumnContentHeight(700);
    flushLayout();
    expect(dialog.style.getPropertyValue('--translation-columns')).toBe('3');
    dialog.style.width = '1200px';
    dialog.style.height = '500px';

    for (const height of [402, 404, 430, 500, 650, 700]) {
      setAvailableHeight(height);
      resizeCallbacks.forEach((callback) => callback());
      flushLayoutFrame();
      expect(dialog.style.getPropertyValue('--translation-columns')).toBe('3');
      flushLayout();
      expect(dialog.style.getPropertyValue('--translation-columns')).toBe('3');
      expect(dialog.style.width).toBe('1200px');
      expect(dialog.style.height).toBe('500px');
    }

    setAvailableHeight(710);
    resizeCallbacks.forEach((callback) => callback());
    flushLayout();
    expect(dialog.style.getPropertyValue('--translation-columns')).toBe('2');

    expect(dialog.classList.contains('modal-container-description-side')).toBe(
      true,
    );

    expect(dialog.style.width).toBe('1200px');
    expect(dialog.style.height).toBe('500px');
    controller.dispose();
  });

  test('starts a new stacked layout when reset and a short snapshot arrive together', () => {
    const { controller, dialog, setContentHeight } = mountOverflowingResult();

    flushLayout();
    expect(dialog.classList.contains('modal-container-columns')).toBe(true);
    setContentHeight(400);

    flushSync(() => {
      controller.reset();

      controller.snapshot({
        segments: [
          {
            index: 0,
            blockIndex: 0,
            originalText: 'Short source',
            translatedText: 'Short translation',
            sourceLanguageCode: 'en-US',
            romanization: null,
          },
        ],
        description: null,
      });
    });

    flushLayout();
    expect(dialog.classList.contains('modal-container-columns')).toBe(false);
    controller.dispose();
  });

  test('keeps a dragged grid visible after resizing without changing its column count', () => {
    const { controller, dialog } = mountOverflowingResult();

    flushLayout();

    const constrain = vi.spyOn(controller.drag, 'constrainToViewport');

    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      left: 420,
      top: 200,
      right: 1270,
      bottom: 750,
      width: 850,
      height: 550,
    } as DOMRect);

    vi.stubGlobal('innerWidth', 1100);
    vi.stubGlobal('innerHeight', 650);
    window.dispatchEvent(new Event('resize'));
    flushLayout();
    expect(dialog.style.getPropertyValue('--translation-columns')).toBe('2');

    expect(constrain).toHaveBeenLastCalledWith(expect.anything(), {
      width: 1100,
      height: 650,
    });

    expect(controller.drag.x).toBe(-170);
    expect(controller.drag.y).toBe(-100);
    controller.dispose();
  });

  test.each(['failed', 'cancelled', 'reset'] as const)(
    '%s clears the expanded layout',
    (transition) => {
      const { controller, dialog, setContentHeight } = mountOverflowingResult();

      flushLayout();
      expect(dialog.classList.contains('modal-container-columns')).toBe(true);
      setContentHeight(400);

      flushSync(() => {
        if (transition === 'failed') {
          controller.failed({
            code: 'NETWORK_CONNECTION_FAILED',
            title: 'Connection Failed',
            userMessage: 'Could not connect to the provider.',
          });
        } else {
          controller[transition]();
        }
      });

      flushLayout();
      expect(dialog.classList.contains('modal-container-columns')).toBe(false);

      expect(dialog.classList.contains('modal-container-compact')).toBe(
        transition !== 'reset',
      );

      controller.dispose();
    },
  );

  test('unmount removes observers, queued measurements and the window listener', () => {
    const { controller, unmount } = mountOverflowingResult();
    const pendingCallbacks = [...resizeCallbacks];

    expect(resizeCallbacks.size).toBeGreaterThan(0);
    expect(frames.size).toBeGreaterThan(0);
    unmount();
    expect(resizeCallbacks.size).toBe(0);
    expect(frames.size).toBe(0);
    pendingCallbacks.forEach((callback) => callback());
    expect(frames.size).toBe(0);
    window.dispatchEvent(new Event('resize'));
    expect(frames.size).toBe(0);
    controller.dispose();
  });
});

describe('UI: live translation modal', () => {
  test('shows the paired source language when hovering either side of a mixed result', async () => {
    const controller = new TranslationModalController({
      original: [
        {
          index: 7,
          text: 'Japanese source',
          language: { code: 'ja-JP', name: 'Japanese' },
          romanization: 'Japanese pronunciation',
          blockIndex: 0,
        },
        {
          index: 19,
          text: 'Korean source',
          language: { code: 'ko-KR', name: 'Korean' },
          romanization: null,
          blockIndex: 1,
        },
      ],
      translated: [
        {
          index: 7,
          text: 'Japanese translation',
          language: { code: 'en-US', name: 'English' },
          romanization: null,
          blockIndex: 0,
        },
        {
          index: 19,
          text: 'Korean translation',
          language: { code: 'en-US', name: 'English' },
          romanization: null,
          blockIndex: 1,
        },
      ],
      description: '',
      detachModal: vi.fn(),
    });

    const { container, getByText } = render(TranslationModal, { controller });
    const sections = container.querySelectorAll('.section');
    const originalLabel = sections[0].querySelector('.section-label-tag');
    const translatedLabel = sections[1].querySelector('.section-label-tag');
    const translatedContent = sections[1].querySelector('.text-content');
    const originalContent = sections[0].querySelector('.text-content');

    if (!translatedContent || !originalContent)
      throw new Error('Missing text content');

    expect(originalLabel?.textContent).toContain('Mixed');

    await fireEvent.pointerMove(getByText('Japanese translation'));
    expect(originalLabel?.textContent).toContain('Japanese (ja-JP)');
    expect(translatedLabel?.textContent).toContain('English (en-US)');
    expect(container.querySelectorAll('.seg-highlight')).toHaveLength(2);

    expect(
      getByText('Japanese source').classList.contains('seg-highlight'),
    ).toBe(true);

    expect(
      getByText('Japanese translation').classList.contains('seg-highlight'),
    ).toBe(true);

    expect(
      getByText('Japanese pronunciation').classList.contains('rom-highlight'),
    ).toBe(true);

    await fireEvent.pointerMove(getByText('Korean translation'));
    expect(originalLabel?.textContent).toContain('Korean (ko-KR)');
    expect(translatedLabel?.textContent).toContain('English (en-US)');
    expect(container.querySelectorAll('.seg-highlight')).toHaveLength(2);

    expect(getByText('Korean source').classList.contains('seg-highlight')).toBe(
      true,
    );

    expect(
      getByText('Korean translation').classList.contains('seg-highlight'),
    ).toBe(true);

    expect(container.querySelector('.rom-highlight')).toBeNull();

    await fireEvent.pointerLeave(translatedContent);
    expect(originalLabel?.textContent).toContain('Mixed');
    expect(container.querySelector('.seg-highlight')).toBeNull();

    await fireEvent.pointerMove(getByText('Japanese source'));
    expect(originalLabel?.textContent).toContain('Japanese (ja-JP)');
    expect(translatedLabel?.textContent).toContain('English (en-US)');

    expect(
      getByText('Japanese translation').classList.contains('seg-highlight'),
    ).toBe(true);

    await fireEvent.pointerLeave(originalContent);
    expect(originalLabel?.textContent).toContain('Mixed');
    expect(container.querySelector('.seg-highlight')).toBeNull();
    expect(container.querySelector('.rom-highlight')).toBeNull();
    controller.dispose();
  });

  test('updates one mounted modal, preserves resized node, and enables Copy only on final', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.assign(navigator, { clipboard: { writeText } });

    const controller = new TranslationModalController({
      original: [],
      translated: [],
      description: '',
      detachModal: vi.fn(),
      live: true,
    });

    const { container } = render(TranslationModal, { controller });
    const dialog = container.querySelector('[role="dialog"]');
    const textBox = container.querySelector<HTMLElement>('.text-box');

    if (!textBox) throw new Error('Missing text box');
    textBox.style.height = '145px';

    flushSync(() => {
      controller.started({ code: 'en-US', name: 'English' });
      controller.reset();

      controller.snapshot({
        segments: [
          {
            index: 0,
            blockIndex: null,
            originalText: 'こんに',
            translatedText: 'Hel',
            sourceLanguageCode: null,
            romanization: null,
          },
        ],
        description: null,
      });
    });

    expect(container.textContent).toContain('Hel');

    expect(
      [...container.querySelectorAll('button.icon-btn')].filter(
        (button) => (button as HTMLButtonElement).disabled,
      ).length,
    ).toBeGreaterThan(0);

    await controller.copy('translated');
    expect(writeText).not.toHaveBeenCalled();

    flushSync(() =>
      controller.snapshot({
        segments: [
          {
            index: 0,
            blockIndex: 0,
            originalText: 'こんにちは',
            translatedText: 'Hello',
            sourceLanguageCode: 'ja-JP',
            romanization: 'konnichiwa',
          },
        ],
        description: null,
      }),
    );

    expect(container.querySelector('[role="dialog"]')).toBe(dialog);
    expect(container.querySelector('.text-box')).toBe(textBox);
    expect(textBox.style.height).toBe('145px');

    flushSync(() =>
      controller.completed(
        {
          id: 'saved',
          original: [
            {
              text: 'こんにちは',
              language: { code: 'ja-JP', name: 'Japanese' },
              romanization: null,
              blockIndex: 0,
            },
          ],
          translated: [
            {
              text: 'Hello',
              language: { code: 'en-US', name: 'English' },
              romanization: null,
              blockIndex: 0,
            },
          ],
          description: '',
          createdAt: new Date(),
        },
        false,
      ),
    );

    expect(container.textContent).toContain('Could not save to history.');
    await controller.copy('translated');
    expect(writeText).toHaveBeenCalledWith('Hello');
    controller.dispose();
  });

  test('keeps row nodes, focus, and resize through updates and clears hover on fallback', async () => {
    const controller = new TranslationModalController({
      original: [],
      translated: [],
      description: '',
      detachModal: vi.fn(),
      live: true,
    });

    const { container, getByRole } = render(TranslationModal, { controller });
    const originalBox = container.querySelector<HTMLElement>('.text-box');

    if (!originalBox) throw new Error('Missing text box');
    originalBox.style.height = '163px';

    flushSync(() => {
      controller.started({ code: 'en-US', name: 'English' });
      controller.reset();

      controller.snapshot({
        segments: [
          {
            index: 0,
            blockIndex: null,
            originalText: 'first',
            translatedText: 'First',
            sourceLanguageCode: null,
            romanization: null,
          },
          {
            index: 1,
            blockIndex: null,
            originalText: 'second',
            translatedText: '',
            sourceLanguageCode: null,
            romanization: null,
          },
        ],
        description: null,
      });
    });

    const row = originalBox.querySelector<HTMLElement>('[data-seg-index="1"]');

    if (!row) throw new Error('Missing second row');
    expect(container.textContent).toContain('…');
    await fireEvent.pointerMove(row);
    expect(row.classList.contains('seg-highlight')).toBe(true);

    const close = getByRole('button', { name: 'Close' });

    close.focus();

    flushSync(() =>
      controller.snapshot({
        segments: [
          {
            index: 0,
            blockIndex: 0,
            originalText: 'first',
            translatedText: 'First',
            sourceLanguageCode: 'ja-JP',
            romanization: null,
          },
          {
            index: 1,
            blockIndex: 0,
            originalText: 'second updated',
            translatedText: 'Second',
            sourceLanguageCode: 'ko-KR',
            romanization: null,
          },
        ],
        description: null,
      }),
    );

    expect(originalBox.querySelector('[data-seg-index="1"]')).toBe(row);
    expect(document.activeElement).toBe(close);
    expect(originalBox.style.height).toBe('163px');
    expect(container.textContent).toContain('Korean (ko-KR)');

    flushSync(() => {
      controller.reset();

      controller.snapshot({
        segments: [
          {
            index: 0,
            blockIndex: null,
            originalText: 'new attempt',
            translatedText: '',
            sourceLanguageCode: null,
            romanization: null,
          },
        ],
        description: null,
      });
    });

    expect(container.querySelector('.seg-highlight')).toBeNull();
    expect(container.querySelector('.text-box')).toBe(originalBox);
    expect(document.activeElement).toBe(close);
    expect(container.textContent).not.toContain('second updated');
    controller.dispose();
  });

  test('Escape closes once and busy and failed previews never enable Copy', async () => {
    const detach = vi.fn();

    const controller = new TranslationModalController({
      original: [],
      translated: [],
      description: '',
      detachModal: detach,
      live: true,
    });

    const { container, getByRole, queryByRole } = render(TranslationModal, {
      controller,
    });

    expect(getByRole('dialog').getAttribute('aria-busy')).toBe('true');

    expect(
      getByRole('button', { name: 'Copy original text' }).hasAttribute(
        'disabled',
      ),
    ).toBe(true);

    expect(
      getByRole('button', { name: 'Copy translated text' }).hasAttribute(
        'disabled',
      ),
    ).toBe(true);

    flushSync(() => {
      controller.started({ code: 'en-US', name: 'English' });
      controller.reset();

      controller.failed({
        code: 'TRANSLATION_CONTENT_BLOCKED',
        title: 'Content blocked',
        userMessage: 'Choose a different area.',
      });
    });

    expect(getByRole('dialog').getAttribute('aria-busy')).toBe('false');
    expect(queryByRole('button', { name: 'Copy original text' })).toBeNull();
    expect(queryByRole('button', { name: 'Copy translated text' })).toBeNull();

    await fireEvent.keyDown(container.querySelector('.modal-backdrop')!, {
      key: 'Escape',
    });

    await fireEvent.keyDown(container.querySelector('.modal-backdrop')!, {
      key: 'Escape',
    });

    expect(detach).toHaveBeenCalledTimes(1);
  });

  test('request rejection shows one error title, description, and retry action', async () => {
    const retry = vi.fn();

    const controller = new TranslationModalController({
      original: [],
      translated: [],
      description: '',
      detachModal: vi.fn(),
      onretry: retry,
      live: true,
    });

    const { container, getByRole, getAllByText, queryByRole } = render(
      TranslationModal,
      { controller },
    );

    flushSync(() =>
      controller.failed({
        code: 'TRANSLATION_REQUEST_REJECTED',
        title: 'Request Rejected',
        userMessage:
          'The provider rejected this request. Check the selected model and provider configuration.',
      }),
    );

    const dialog = getByRole('dialog', { name: 'Request Rejected' });
    const retryButton = getByRole('button', { name: 'Select area again' });

    expect(dialog.classList.contains('modal-container-compact')).toBe(true);

    expect(container.querySelector('.modal-header-title')?.textContent).toBe(
      'Translation failed',
    );

    expect(getAllByText('Request Rejected')).toHaveLength(1);

    const title = getByRole('heading', { level: 2, name: 'Request Rejected' });

    expect(container.querySelector('.modal-body')?.contains(title)).toBe(true);
    expect(title.classList.contains('translation-error-title')).toBe(true);

    expect(getByRole('alert').textContent).toContain(
      'The provider rejected this request. Check the selected model and provider configuration.',
    );

    expect(queryByRole('status')).toBeNull();
    expect(container.querySelector('.translation-status-dots')).toBeNull();
    expect(container.querySelector('.section')).toBeNull();
    expect(container.querySelector('.text-box')).toBeNull();
    expect(container.querySelector('.description-box')).toBeNull();
    expect(container.querySelector('.resize-handle')).toBeNull();
    expect(container.querySelector('.modal-footer-drag')).toBeNull();
    expect(dialog.querySelectorAll('button')).toHaveLength(2);
    expect(document.activeElement).toBe(retryButton);
    await fireEvent.click(retryButton);
    expect(retry).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  test('failure replaces a resized draft with compact feedback without moving the modal', () => {
    const controller = new TranslationModalController({
      original: [],
      translated: [],
      description: '',
      detachModal: vi.fn(),
      live: true,
    });

    const { container, getByRole } = render(TranslationModal, { controller });
    const dialog = getByRole('dialog');

    dialog.style.width = '800px';
    dialog.style.height = '700px';

    flushSync(() => {
      controller.drag.x = 43;
      controller.drag.y = -27;
      controller.started({ code: 'en-US', name: 'English' });
      controller.reset();

      controller.snapshot({
        segments: [
          {
            index: 0,
            blockIndex: null,
            originalText: 'source preview',
            translatedText: 'unfinished translation',
            sourceLanguageCode: null,
            romanization: null,
          },
        ],
        description: 'unfinished description',
      });
    });

    expect(container.textContent).toContain('source preview');
    expect(container.querySelectorAll('.section')).toHaveLength(3);

    flushSync(() =>
      controller.failed({
        code: 'NETWORK_CONNECTION_FAILED',
        title: 'Connection Failed',
        userMessage: 'Could not connect to the provider.',
      }),
    );

    expect(getByRole('dialog', { name: 'Connection Failed' })).toBe(dialog);
    expect(dialog.classList.contains('modal-container-compact')).toBe(true);

    expect(container.querySelector('.modal-header-title')?.textContent).toBe(
      'Translation failed',
    );

    expect(
      getByRole('heading', { level: 2, name: 'Connection Failed' }).closest(
        '.modal-body',
      ),
    ).toBeTruthy();

    expect(container.querySelector('.translation-status')).toBeNull();
    expect(container.querySelector('.translation-status-dots')).toBeNull();
    expect(dialog.style.transform).toBe('translate(43px, -27px)');
    expect(container.textContent).not.toContain('source preview');
    expect(container.textContent).not.toContain('unfinished translation');
    expect(container.textContent).not.toContain('unfinished description');
    expect(container.querySelector('.section')).toBeNull();
    expect(container.querySelector('.icon-btn')).toBeNull();
    expect(container.querySelector('.resize-handle')).toBeNull();
    expect(container.querySelector('.modal-footer-drag')).toBeNull();
    expect(controller.canCopy).toBe(false);
    controller.dispose();
  });

  test('cancellation uses compact feedback with one restart action and the close affordance', () => {
    const controller = new TranslationModalController({
      original: [],
      translated: [],
      description: '',
      detachModal: vi.fn(),
      live: true,
    });

    const { container, getByRole } = render(TranslationModal, { controller });

    flushSync(() => controller.cancelled());

    const dialog = getByRole('dialog', { name: 'Translation cancelled' });

    expect(dialog.classList.contains('modal-container-compact')).toBe(true);

    expect(container.querySelector('.modal-header-title')?.textContent).toBe(
      'Translation',
    );

    expect(
      getByRole('heading', { level: 2, name: 'Translation cancelled' }).closest(
        '.modal-body',
      ),
    ).toBeTruthy();

    expect(getByRole('alert').textContent).toContain(
      'Select an area to start a new translation.',
    );

    expect(container.querySelector('.translation-status')).toBeNull();
    expect(container.querySelector('.translation-status-dots')).toBeNull();
    expect(getByRole('button', { name: 'Select area again' })).toBeTruthy();
    expect(getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(dialog.querySelectorAll('button')).toHaveLength(2);
    expect(container.querySelector('.section')).toBeNull();
    controller.dispose();
  });

  test('busy status stays beside the header label with decorative dots, then becomes static Complete', () => {
    const controller = new TranslationModalController({
      original: [],
      translated: [],
      description: '',
      detachModal: vi.fn(),
      live: true,
    });

    const { container, getByRole } = render(TranslationModal, { controller });

    function expectBusyHeader(label: string) {
      const header = container.querySelector('.modal-header');
      const title = container.querySelector('.modal-header-title');
      const status = getByRole('status');
      const dots = status.querySelector('.translation-status-dots');
      const close = getByRole('button', { name: 'Close' });

      if (!header || !title || !dots) throw new Error('Missing busy header');
      expect(title.textContent).toBe('Translation');
      expect(header.contains(status)).toBe(true);

      expect(
        title.compareDocumentPosition(status) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      expect(
        status.compareDocumentPosition(close) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      expect(dots.getAttribute('aria-hidden')).toBe('true');

      const accessibleContent = status.cloneNode(true) as HTMLElement;

      for (const hidden of accessibleContent.querySelectorAll(
        '[aria-hidden="true"]',
      ))
        hidden.remove();
      expect(accessibleContent.textContent?.trim()).toBe(label);
      expect(container.querySelector('.modal-body [role="status"]')).toBeNull();

      expect(
        container.querySelector('.modal-body .translation-status'),
      ).toBeNull();
    }

    expectBusyHeader('Preparing');

    flushSync(() => {
      controller.started({ code: 'en-US', name: 'English' });
      controller.reset();
    });

    expectBusyHeader('Translating');
    flushSync(() => controller.reset());
    expectBusyHeader('Retrying');
    flushSync(() => controller.committing());
    expectBusyHeader('Finishing');

    flushSync(() =>
      controller.completed(
        {
          id: 'complete',
          original: [
            {
              text: 'source',
              language: { code: 'ja-JP', name: 'Japanese' },
              romanization: null,
              blockIndex: 0,
            },
          ],
          translated: [
            {
              text: 'Hello',
              language: { code: 'en-US', name: 'English' },
              romanization: null,
              blockIndex: 0,
            },
          ],
          description: '',
          createdAt: new Date(),
        },
        true,
      ),
    );

    const status = getByRole('status');

    expect(container.querySelector('.modal-header')?.contains(status)).toBe(
      true,
    );

    expect(status.textContent?.trim()).toBe('Complete');
    expect(container.querySelector('.translation-status-dots')).toBeNull();
    expect(container.querySelector('.modal-body [role="status"]')).toBeNull();
    expect(getByRole('dialog').getAttribute('aria-busy')).toBe('false');
    controller.dispose();
  });
});
