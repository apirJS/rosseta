import { getContext, setContext } from 'svelte';
import type { PopupToastController } from '../toast/PopupToastController.svelte';

const TOAST_CONTEXT_KEY = Symbol('popup-toast');

export function setPopupToastContext(controller: PopupToastController): void {
  setContext(TOAST_CONTEXT_KEY, controller);
}

export function getPopupToastContext(): PopupToastController {
  const context = getContext<PopupToastController>(TOAST_CONTEXT_KEY);
  if (!context) {
    throw new Error(
      'Popup toast context not found. Did you forget to call setPopupToastContext?',
    );
  }
  return context;
}
