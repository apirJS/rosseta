export type ToastType = 'loading' | 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  dismissing?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

interface ShowOptions {
  type: ToastType;
  message: string;
  description?: string;
  id?: string;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

const MAX_TOASTS = 5;
const DISMISS_ANIMATION_MS = 250;

let nextId = 0;

export class ToastController {
  public toasts = $state<ToastItem[]>([]);
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  show(opts: ShowOptions): string {
    const id = opts.id ?? `toast-${nextId++}`;
    const duration = opts.duration ?? (opts.type === 'loading' ? 0 : 4000);

    const item: ToastItem = {
      id,
      type: opts.type,
      message: opts.message,
      description: opts.description,
      duration,
      actionLabel: opts.actionLabel,
      onAction: opts.onAction,
    };

    this.toasts = [item, ...this.toasts].slice(0, MAX_TOASTS);

    if (duration > 0) {
      this.startTimer(id, duration);
    }

    return id;
  }

  update(id: string, opts: Partial<ShowOptions>): void {
    const idx = this.toasts.findIndex((t) => t.id === id);
    if (idx === -1) return;

    this.clearTimer(id);

    const current = this.toasts[idx];
    const updated: ToastItem = {
      ...current,
      ...opts,
      id,
      dismissing: false,
    };

    const duration = opts.duration ?? (updated.type === 'loading' ? 0 : 4000);
    updated.duration = duration;

    const copy = [...this.toasts];
    copy[idx] = updated;
    this.toasts = copy;

    if (duration > 0) {
      this.startTimer(id, duration);
    }
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

export const toastController = new ToastController();
