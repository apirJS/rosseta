import { mount, unmount } from 'svelte';
import translationModalStyles from '../../ui/injected/translation-result-modal/translation-modal.css?inline';
import TranslationModal from '../../ui/injected/translation-result-modal/TranslationModal.svelte';
import { createShadowDomHost } from '../hosts/ShadowDomHost';
import type { ThemeManager } from '../hosts/ThemeManager';
import type { Translation } from '../../../../core/domain/translation/Translation';

/**
 * Payload shape for mounting a translation modal.
 */
export interface TranslationModalPayload {
  id: string;
  original: {
    language: { code: string; name: string };
    text: string;
    romanization: string | null;
  }[];
  translated: {
    language: { code: string; name: string };
    text: string;
    romanization: string | null;
  }[];
  description: string;
  createdAt: Date;
}

/**
 * Maps a Translation domain entity to the modal payload format.
 */
export function serializeForModal(
  translation: Translation,
): TranslationModalPayload {
  return {
    id: translation.id,
    original: translation.original.map((s) => ({
      language: { code: s.language.code, name: s.language.name },
      text: s.text,
      romanization: s.romanization,
    })),
    translated: translation.translated.map((s) => ({
      language: { code: s.language.code, name: s.language.name },
      text: s.text,
      romanization: s.romanization,
    })),
    description: translation.description,
    createdAt: translation.createdAt,
  };
}

/**
 * Handles mounting and unmounting translation result modals.
 *
 * Each translation gets its own Shadow DOM host (keyed by translation ID),
 * allowing multiple modals to coexist. Integrates with ThemeManager for
 * dark/light theme tracking.
 */
export class TranslationModalHandler {
  constructor(private readonly themeManager: ThemeManager) {}

  handle(payload: TranslationModalPayload): void {
    try {
      const hostId = `rosseta-modal-${payload.id}`;

      const { host, appContainer } = createShadowDomHost({
        hostId,
        styles: translationModalStyles,
        hostStyles: {
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100vw',
          height: '100vh',
          zIndex: '2147483647',
          pointerEvents: 'none',
          margin: '0',
          padding: '0',
          border: 'none',
          overflow: 'hidden',
        },
      });

      this.themeManager.registerHost(host);

      const detachModal = () => {
        unmount(app);
        host.remove();
        this.themeManager.unregisterHost(host);
      };

      const app = mount(TranslationModal, {
        target: appContainer,
        props: {
          ...payload,
          detachModal,
        },
      });
    } catch (error) {
      console.error('[TranslationModalHandler] Failed to mount modal:', error);
    }
  }
}
