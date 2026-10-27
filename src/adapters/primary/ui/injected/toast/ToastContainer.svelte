<script lang="ts">
  import { onDestroy } from 'svelte';
  import ToastNotification from './ToastNotification.svelte';
  import {
    toastController,
    type ToastController,
  } from './ToastController.svelte';

  interface Props {
    controller?: ToastController;
  }

  const { controller = toastController }: Props = $props();

  onDestroy(() => controller.clear());
</script>

<div class="toast-container" aria-live="polite" aria-relevant="additions text">
  {#each controller.toasts as toast (toast.id)}
    <ToastNotification
      {toast}
      onclose={() => controller.dismiss(toast.id)}
      onaction={() => controller.activate(toast.id)}
    />
  {/each}
</div>
