<script lang="ts">
  import type { ToastItem } from './ToastController.svelte';
  import ToastStatusIcon from './ToastStatusIcon.svelte';

  interface Props {
    toast: ToastItem;
    onclose: () => void;
    onaction: () => void;
  }

  const { toast, onclose, onaction }: Props = $props();
</script>

<div class="toast" class:dismissing={toast.dismissing}>
  <ToastStatusIcon type={toast.type} />

  <div class="toast-content">
    <div class="toast-message">{toast.message}</div>
    {#if toast.description}
      <div class="toast-description">{toast.description}</div>
    {/if}
  </div>

  {#if toast.onAction}
    <button
      type="button"
      class="toast-action"
      onclick={onaction}
      disabled={toast.dismissing}
    >
      {toast.actionLabel ?? 'Retry'}
    </button>
  {/if}

  <button
    type="button"
    class="toast-close"
    onclick={onclose}
    aria-label="Close toast"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </button>
</div>
