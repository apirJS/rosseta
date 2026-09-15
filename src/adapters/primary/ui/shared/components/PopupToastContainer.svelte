<script lang="ts">
  import { getPopupToastContext } from '../context/toast';
  import Icon from './Icon.svelte';
  import { cn } from '../utils';

  const controller = getPopupToastContext();

  type ToastType = 'loading' | 'success' | 'error' | 'info';

  const ICON_NAME: Record<ToastType, 'check' | 'alert-circle' | 'spinner' | 'info'> = {
    success: 'check',
    error: 'alert-circle',
    loading: 'spinner',
    info: 'info',
  };

  const ICON_COLOR: Record<ToastType, string> = {
    success: 'text-success',
    error: 'text-destructive',
    loading: 'text-primary',
    info: 'text-muted',
  };
</script>

{#if controller.toasts.length > 0}
  <div
    class="fixed bottom-2 left-2 right-2 z-50 flex flex-col gap-2 pointer-events-none"
  >
    {#each controller.toasts as toast, i (toast.id)}
      <div
        class={cn(
          'popup-toast flex items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 py-2.5 shadow-md pointer-events-auto',
          'transition-[opacity,translate,scale] duration-200',
          i === 1 && 'opacity-85 scale-[0.97]',
          i === 2 && 'opacity-70 scale-[0.94]',
          i >= 3 && 'opacity-55 scale-[0.91]',
          toast.dismissing && 'opacity-0 -translate-y-2',
        )}
        role={toast.type === 'error' ? 'alert' : 'status'}
      >
        <span class={cn('shrink-0', ICON_COLOR[toast.type])}>
          <Icon name={ICON_NAME[toast.type]} class="w-[18px] h-[18px]" />
        </span>
        <div class="flex-1 min-w-0">
          <p class="text-[13px] font-medium text-foreground break-words">
            {toast.message}
          </p>
          {#if toast.description}
            <p class="mt-0.5 text-xs text-muted break-words">
              {toast.description}
            </p>
          {/if}
        </div>
        <button
          type="button"
          class="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border border-border text-muted transition-colors hover:bg-border hover:text-foreground cursor-pointer"
          onclick={() => controller.dismiss(toast.id)}
          aria-label="Close"
        >
          <Icon name="x" class="w-3 h-3" />
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .popup-toast {
    animation: popup-toast-in 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes popup-toast-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
