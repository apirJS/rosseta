import { mount, unmount } from 'svelte';
import TranslationModal from './TranslationModal.svelte';
import styles from './translation-modal.css?inline';
import { TranslationModalController } from './TranslationModalController.svelte';
import { createShadowDomHost } from '../../../content/hosts/ShadowDomHost';
import type { TranslationView } from './TranslationView';
import type { ThemeManager } from '../../../content/hosts/ThemeManager';
import type { TranslationModalPayload } from '../../../../../shared/types/TranslationModalPayload';
import { sendMessageToRuntime } from '../../../../../shared/messaging';

export interface MountedTranslationView {
  view: TranslationView;
  detach(): void;
}

export function mountTranslationModal(
  themeManager: ThemeManager,
  hostId: string,
  onclose: () => void,
  final?: TranslationModalPayload,
): MountedTranslationView {
  const { host, appContainer } = createShadowDomHost({
    hostId,
    styles,
    hostStyles: {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '0',
      height: '0',
      zIndex: '2147483647',
      pointerEvents: 'none',
      background: 'transparent',
      margin: '0',
      padding: '0',
      border: 'none',
      overflow: 'visible',
    },
  });

  themeManager.registerHost(host);

  const ctrl = new TranslationModalController({
    original: final?.original ?? [],
    translated: final?.translated ?? [],
    description: final?.description ?? '',
    detachModal: onclose,
    live: !final,
    onretry: () => {
      ctrl.close();
      void sendMessageToRuntime({ action: 'START_OVERLAY' }).catch(() => {});
    },
  });

  const app = mount(TranslationModal, {
    target: appContainer,
    props: { controller: ctrl },
  });

  let detached = false;

  return {
    view: ctrl,
    detach() {
      if (detached) return;
      detached = true;
      ctrl.dispose();
      void unmount(app);
      host.remove();
      themeManager.unregisterHost(host);
    },
  };
}
