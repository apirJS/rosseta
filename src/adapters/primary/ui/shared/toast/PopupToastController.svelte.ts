export type PopupToastType = 'loading' | 'success' | 'error' | 'info';

export interface PopupToastItem {
  id: string;
  type: PopupToastType;
  message: string;
  description?: string;
  dismissing?: boolean;
}

export interface PopupToastShowOptions {
  type: PopupToastType;
  message: string;
  description?: string;
  id?: string;
  duration?: number;
}

export type PopupToastUpdateOptions = Partial<Omit<PopupToastShowOptions, 'id'>>;

const MAX_TOASTS = 5;
const DISMISS_ANIMATION_MS = 200;
const DEFAULT_DURATION_MS = 4000;

let nextId = 0;

export class PopupToastController {
  toasts = $state<PopupToastItem[]>([]);
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  show(opts: PopupToastShowOptions): string {
    const id = opts.id ?? `popup-toast-${nextId++}`;
    const duration =
      opts.duration ?? (opts.type === 'loading' ? 0 : DEFAULT_DURATION_MS);

    this.toasts = [
      { id, type: opts.type, message: opts.message, description: opts.description },
      ...this.toasts,
    ].slice(0, MAX_TOASTS);

    if (duration > 0) this.startTimer(id, duration);
    return id;
  }

  update(id: string, opts: PopupToastUpdateOptions): void {
    const idx = this.toasts.findIndex((t) => t.id === id);
    if (idx === -1) return;

    this.clearTimer(id);

    const current = this.toasts[idx];
    const type = opts.type ?? current.type;
    const duration =
      opts.duration ?? (type === 'loading' ? 0 : DEFAULT_DURATION_MS);

    const copy = [...this.toasts];
    copy[idx] = {
      ...current,
      ...opts,
      id,
      type,
      dismissing: false,
    };
    this.toasts = copy;

    if (duration > 0) this.startTimer(id, duration);
  }

  dismiss(id: string): void {
    this.clearTimer(id);

    const idx = this.toasts.findIndex((t) => t.id === id);
    if (idx === -1) return;

    const copy = [...this.toasts];
    copy[idx] = { ...copy[idx], dismissing: true };
    this.toasts = copy;

    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }, DISMISS_ANIMATION_MS);
  }

  private startTimer(id: string, duration: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(id);
      this.dismiss(id);
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
