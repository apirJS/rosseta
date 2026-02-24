import * as browser from 'webextension-polyfill';
import { mount } from 'svelte';
import toastStyles from '../../ui/injected/toast/toast.css?inline';
import ToastContainer from '../../ui/injected/toast/ToastContainer.svelte';
import { toastController } from '../../ui/injected/toast/ToastController.svelte';
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
 * Error toasts automatically include a Retry action.
 */
export class ToastHandler {
  private static readonly HOST_ID = 'rosseta-toast-host';
  private host: HTMLElement | null = null;

  constructor(private readonly themeManager: ThemeManager) {}

  /**
   * Shows or updates a toast notification.
   * Error toasts automatically get a Retry button.
   */
  show(payload: ShowToastPayload): void {
    this.ensureHost();

    const { id, type, message, description, duration } = payload;

    if (type === 'error') {
      this.showError(payload);
      return;
    }

    if (id) {
      const existing = toastController.toasts.find((t) => t.id === id);
      if (existing) {
        toastController.update(id, { type, message, description, duration });
      } else {
        toastController.show({ id, type, message, description, duration });
      }
    } else {
      toastController.show({ type, message, description, duration });
    }
  }

  /** Dismisses a toast by ID. */
  dismiss(id: string): void {
    toastController.dismiss(id);
  }

  private showError(payload: ShowToastPayload): void {
    const { id, message, description } = payload;
    const errorDuration = payload.duration ?? 6000;
    const onAction = () =>
      browser.runtime.sendMessage({ action: 'START_OVERLAY' });

    if (id && toastController.toasts.find((t) => t.id === id)) {
      toastController.update(id, {
        type: 'error',
        message,
        description,
        duration: errorDuration,
        actionLabel: 'Retry',
        onAction,
      });
    } else {
      toastController.show({
        id,
        type: 'error',
        message,
        description,
        duration: errorDuration,
        actionLabel: 'Retry',
        onAction,
      });
    }
  }

  /**
   * Ensures a persistent Shadow DOM host exists for the toast container.
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
