<script lang="ts">
  import type { PopupToastItem } from './PopupToastController.svelte';
  import PopupToast from './PopupToast.svelte';

  interface Props {
    toasts: PopupToastItem[];
    ondismiss: (id: string) => void;
  }

  const { toasts, ondismiss }: Props = $props();
</script>

{#if toasts.length > 0}
  <div
    class="fixed bottom-2 left-2 right-2 z-50 flex flex-col gap-2 pointer-events-none"
  >
    {#each toasts as toast, i (toast.id)}
      <PopupToast {toast} index={i} {ondismiss} />
    {/each}
  </div>
{/if}
