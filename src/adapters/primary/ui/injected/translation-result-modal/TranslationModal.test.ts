import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import TranslationModal from './TranslationModal.svelte';
import { TranslationModalController } from './TranslationModalController.svelte';

afterEach(cleanup);

describe('UI: live translation modal', () => {
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
