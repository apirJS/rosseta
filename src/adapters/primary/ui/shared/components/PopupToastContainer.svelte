<script lang="ts">
  import { getPopupToastContext } from '../context/toast';
  import PopupToast from './PopupToast.svelte';

  const controller = getPopupToastContext();
</script>

{#if controller.toasts.length > 0}
  <div
    class="fixed bottom-2 left-2 right-2 z-50 flex flex-col gap-2 pointer-events-none"
  >
    {#each controller.toasts as toast, i (toast.id)}
      <PopupToast {toast} index={i} ondismiss={controller.dismiss} />
    {/each}
  </div>
{/if}
