<script lang="ts">
  import Toast from './Toast.svelte';
  import { toastController } from './ToastController.svelte';
</script>

<div class="toast-container">
  {#each toastController.toasts as toast (toast.id)}
    <Toast {toast} onclose={() => toastController.dismiss(toast.id)} />
  {/each}
</div>
