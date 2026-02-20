import { mount } from 'svelte';
import toastStyles from '../../ui/injected/toast/toast.css?inline';
import ToastContainer from '../../ui/injected/toast/ToastContainer.svelte';
import type { ToastController } from '../../ui/injected/toast/ToastController.svelte';
import { createShadowDomHost } from '../hosts/ShadowDomHost';
import type { ThemeManager } from '../hosts/ThemeManager';

/**
 * Payload shape for SHOW_TOAST messages.
 */
interface ShowToastPayload {
  id?: string;
  type: 'loading' | 'success' | 'error' | 'info';
  message: string;
  description?: string;
  duration?: number;
}

/**
 * Handles toast notification mounting, showing, and dismissing.
 *
 * Lazily creates a persistent Shadow DOM host for the toast container.
 * Integrates with ThemeManager for dark/light theme tracking.
 */
export class ToastHandler {
  private static readonly HOST_ID = 'rosseta-toast-host';
  private host: HTMLElement | null = null;

  constructor(
    private readonly themeManager: ThemeManager,
    private readonly toast: ToastController,
  ) {}

  /**
   * Shows or updates a toast notification.
   * Lazily creates the toast host on first use.
   */
  show(payload: ShowToastPayload): void {
    this.ensureHost();

    const { id, type, message, description, duration } = payload;

    if (id) {
      const existing = this.toast.toasts.find((t) => t.id === id);
      if (existing) {
        this.toast.update(id, { type, message, description, duration });
      } else {
        this.toast.show({ id, type, message, description, duration });
      }
    } else {
      this.toast.show({ type, message, description, duration });
    }
  }

  /**
   * Dismisses a toast by ID.
   */
  dismiss(id: string): void {
    this.toast.dismiss(id);
  }

  /**
   * Ensures a persistent Shadow DOM host exists for the toast container.
   * Created once on first use and reused for all toast notifications.
   */
  private ensureHost(): void {
    if (this.host) return;

    const { host } = createShadowDomHost({
      hostId: ToastHandler.HOST_ID,
      styles: toastStyles,
      hostStyles: {
        position: 'fixed',
        top: '0',
        right: '0',
        width: '0',
        height: '0',
        zIndex: '2147483647',
        pointerEvents: 'none',
        margin: '0',
        padding: '0',
        border: 'none',
        overflow: 'visible',
      },
    });

    this.themeManager.registerHost(host);
    this.host = host;

    mount(ToastContainer, {
      target: host.shadowRoot!.querySelector('div')!,
    });
  }
}
