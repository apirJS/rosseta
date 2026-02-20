export type ToastType = 'loading' | 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  dismissing?: boolean;
}

interface ShowOptions {
  type: ToastType;
  message: string;
  description?: string;
  /** Optional external id so the toast can be updated later. */
  id?: string;
  /** Auto-dismiss duration in ms. 0 = no auto-dismiss. Default: 4000 (loading: 0) */
  duration?: number;
}

const MAX_TOASTS = 5;
const DISMISS_ANIMATION_MS = 250;

let nextId = 0;

/**
 * Singleton reactive toast controller.
 * Manages a stack of toast notifications using Svelte 5 runes.
 */
export class ToastController {
  public toasts = $state<ToastItem[]>([]);
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Show a new toast. Returns its id for later dismiss/update. */
  show(opts: ShowOptions): string {
    const id = opts.id ?? `toast-${nextId++}`;
    const duration = opts.duration ?? (opts.type === 'loading' ? 0 : 4000);

    const item: ToastItem = {
      id,
      type: opts.type,
      message: opts.message,
      description: opts.description,
      duration,
    };

    // Prepend so newest appears at top
    this.toasts = [item, ...this.toasts].slice(0, MAX_TOASTS);

    if (duration > 0) {
      this.startTimer(id, duration);
    }

    return id;
  }

  /** Update an existing toast's properties. */
  update(id: string, opts: Partial<ShowOptions>): void {
    const idx = this.toasts.findIndex((t) => t.id === id);
    if (idx === -1) return;

    // Clear existing timer
    this.clearTimer(id);

    const current = this.toasts[idx];
    const updated: ToastItem = {
      ...current,
      ...opts,
      id, // preserve id
      dismissing: false, // reset dismissing state on update
    };

    // Recalculate duration
    const duration = opts.duration ?? (updated.type === 'loading' ? 0 : 4000);
    updated.duration = duration;

    const copy = [...this.toasts];
    copy[idx] = updated;
    this.toasts = copy;

    if (duration > 0) {
      this.startTimer(id, duration);
    }
  }

  /** Dismiss a toast with fade-out animation. */
  dismiss(id: string): void {
    this.clearTimer(id);

    // Set dismissing state for animation
    const idx = this.toasts.findIndex((t) => t.id === id);
    if (idx === -1) return;

    const copy = [...this.toasts];
    copy[idx] = { ...copy[idx], dismissing: true };
    this.toasts = copy;

    // Remove after animation completes
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }, DISMISS_ANIMATION_MS);
  }

  private startTimer(id: string, duration: number): void {
    const timer = setTimeout(() => {
      this.dismiss(id);
      this.timers.delete(id);
    }, duration);
    this.timers.set(id, timer);
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}

/** Singleton instance */
export const toastController = new ToastController();
