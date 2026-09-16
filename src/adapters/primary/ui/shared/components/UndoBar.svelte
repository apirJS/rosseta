<script lang="ts">
  interface Props {
    message: string;
    onundo: () => void;
  }

  const { message, onundo }: Props = $props();
</script>

<div
  class="flex items-center justify-between px-3 py-2 bg-surface border-t border-border text-sm"
>
  <span class="text-muted">{message}</span>
  <button
    type="button"
    class="text-primary font-medium hover:underline cursor-pointer"
    onclick={onundo}
  >
    Undo
  </button>
</div>
