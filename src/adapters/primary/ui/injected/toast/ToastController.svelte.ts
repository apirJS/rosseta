export type ToastType = 'loading' | 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  dismissing?: boolean;
  actionLabel?: string;
  onAction?: () => void | Promise<unknown>;
}

export interface ToastShowOptions {
  type: ToastType;
  message: string;
  description?: string;
  id?: string;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void | Promise<unknown>;
}

export type ToastUpdateOptions = Partial<Omit<ToastShowOptions, 'id'>>;

const MAX_TOASTS = 5;
const DISMISS_ANIMATION_MS = 250;
const DEFAULT_DURATION_MS = 4000;

let nextId = 0;

export class ToastController {
  public toasts = $state<ToastItem[]>([]);
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private disposed = false;

  public show(opts: ToastShowOptions): string {
    const id = opts.id ?? `toast-${nextId++}`;

    if (this.disposed) return id;

    this.clearTimer(id);

    const duration = this.durationFor(opts.type, opts.duration);

    const item: ToastItem = {
      id,
      type: opts.type,
      message: opts.message,
      description: opts.description,
      duration,
      actionLabel: opts.actionLabel,
      onAction: opts.onAction,
    };

    const toasts = [item, ...this.toasts.filter((toast) => toast.id !== id)];

    for (const evicted of toasts.slice(MAX_TOASTS)) {
      this.clearTimer(evicted.id);
    }

    this.toasts = toasts.slice(0, MAX_TOASTS);

    if (duration > 0) {
      this.schedule(id, duration, () => this.dismiss(id));
    }

    return id;
  }

  public update(id: string, opts: ToastUpdateOptions): void {
    if (this.disposed) return;

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

    const duration = this.durationFor(updated.type, opts.duration);

    updated.duration = duration;

    const copy = [...this.toasts];

    copy[idx] = updated;
    this.toasts = copy;

    if (duration > 0) {
      this.schedule(id, duration, () => this.dismiss(id));
    }
  }

  public dismiss(id: string): void {
    if (this.disposed) return;

    const idx = this.toasts.findIndex((t) => t.id === id);

    if (idx === -1) return;
    if (this.toasts[idx].dismissing) return;

    this.clearTimer(id);

    const copy = [...this.toasts];

    copy[idx] = { ...copy[idx], dismissing: true };
    this.toasts = copy;

    this.schedule(id, DISMISS_ANIMATION_MS, () => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    });
  }

  public activate = async (id: string): Promise<void> => {
    if (this.disposed) return;

    const toast = this.toasts.find((item) => item.id === id);

    if (!toast?.onAction || toast.dismissing) return;

    this.dismiss(id);

    try {
      await toast.onAction();
    } catch (error) {
      console.error('Failed to run toast action:', error);
    }
  };

  public dispose = (): void => {
    this.disposed = true;
    this.clear();
  };

  public clear = (): void => {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.toasts = [];
  };

  private durationFor(type: ToastType, duration?: number): number {
    return duration ?? (type === 'loading' ? 0 : DEFAULT_DURATION_MS);
  }

  private schedule(id: string, duration: number, action: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(id);
      action();
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
