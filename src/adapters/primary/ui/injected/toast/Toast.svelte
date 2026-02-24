<script lang="ts">
  import type { ToastItem } from './ToastController.svelte.ts';

  interface Props {
    toast: ToastItem;
    onclose: () => void;
  }

  let { toast, onclose }: Props = $props();
</script>

<div class="toast {toast.dismissing ? 'dismissing' : ''}">
  <!-- Icon -->
  <div class="toast-icon {toast.type}">
    {#if toast.type === 'loading'}
      <!-- Spinner -->
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
      </svg>
    {:else if toast.type === 'success'}
      <!-- Checkmark circle -->
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    {:else if toast.type === 'error'}
      <!-- X circle -->
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    {:else}
      <!-- Info circle -->
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    {/if}
  </div>

  <!-- Content -->
  <div class="toast-content">
    <div class="toast-message">{toast.message}</div>
    {#if toast.description}
      <div class="toast-description">{toast.description}</div>
    {/if}
  </div>

  <!-- Action button (e.g. Retry) -->
  {#if toast.onAction}
    <button
      class="toast-action"
      onclick={() => {
        toast.onAction?.();
        onclose();
      }}
    >
      {toast.actionLabel ?? 'Retry'}
    </button>
  {/if}

  <!-- Close button -->
  <button class="toast-close" onclick={onclose} aria-label="Close toast">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </button>
</div>
