import { mount, unmount } from 'svelte';
import tailwindStyles from '../../ui/styles/app.css?inline';
import Overlay from '../../ui/injected/screen-overlay/Overlay.svelte';
import { CSS_MAX_Z_INDEX } from '../../ui/shared/constants/ui';

export class OverlayHandler {
  private static readonly HOST_ID = 'rosseta-host';

  handle(rawImage: string): void {
    if (document.getElementById(OverlayHandler.HOST_ID)) return;

    const savedScrollX = window.scrollX;
    const savedScrollY = window.scrollY;
    const captureWidth = window.innerWidth;

    const host = document.createElement('div');
    host.id = OverlayHandler.HOST_ID;
    host.style.opacity = '0';

    const shadowRoot = host.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = tailwindStyles;
    shadowRoot.appendChild(styleEl);

    const appContainer = document.createElement('div');
    Object.assign(appContainer.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: CSS_MAX_Z_INDEX,
      pointerEvents: 'auto',
    } satisfies Partial<CSSStyleDeclaration>);

    const preventScroll = (e: Event) => e.preventDefault();
    const SCROLL_KEYS = new Set([
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      ' ',
      'PageUp',
      'PageDown',
      'Home',
      'End',
    ]);
    const preventScrollKeys = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.has(e.key)) e.preventDefault();
    };

    appContainer.addEventListener('wheel', preventScroll, { passive: false });
    appContainer.addEventListener('touchmove', preventScroll, {
      passive: false,
    });
    document.addEventListener('keydown', preventScrollKeys);

    shadowRoot.appendChild(appContainer);
    document.body.appendChild(host);

    const detachOverlay = () => {
      document.removeEventListener('keydown', preventScrollKeys);
      window.scrollTo(savedScrollX, savedScrollY);
      unmount(app);
      host.remove();
    };

    const onReady = () => {
      host.style.opacity = '1';
    };

    const app = mount(Overlay, {
      target: appContainer,
      props: {
        viewportImg: rawImage,
        captureWidth,
        detachOverlay,
        onReady,
      },
    });
  }
}
