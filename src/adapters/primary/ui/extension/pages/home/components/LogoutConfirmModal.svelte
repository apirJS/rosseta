<script lang="ts">
  import { Icon } from '../../../../shared/components';

  interface Props {
    onconfirm: (deleteHistory: boolean) => void;
    oncancel: () => void;
  }

  const { onconfirm, oncancel }: Props = $props();

  let deleteHistory = $state(true);

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') oncancel();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="fixed inset-0 z-50 flex items-center justify-center">
  <!-- Blur backdrop -->
  <button
    type="button"
    class="absolute inset-0 bg-black/60 backdrop-blur-sm border-none p-0 m-0 cursor-default"
    aria-label="Close modal"
    onclick={oncancel}
  ></button>

  <!-- Modal content -->
  <div
    class="relative z-10 bg-background border border-border rounded-xl p-5 mx-4 max-w-[340px] w-full shadow-xl"
  >
    <!-- Header -->
    <div class="flex items-center gap-2 mb-3">
      <div
        class="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0"
      >
        <Icon name="logout" class="w-4 h-4 text-red-400" />
      </div>
      <h3 class="text-sm font-semibold text-foreground">Sign Out</h3>
    </div>

    <!-- Warning message -->
    <p class="text-xs text-muted leading-relaxed mb-4">
      This will remove all saved API keys. You'll need to re-enter them to use
      the extension again.
    </p>

    <!-- Delete history checkbox -->
    <label
      class="flex items-center gap-2 mb-5 cursor-pointer group select-none"
    >
      <input
        type="checkbox"
        bind:checked={deleteHistory}
        class="w-4 h-4 rounded border-border accent-red-500 cursor-pointer"
      />
      <span
        class="text-xs text-muted group-hover:text-foreground transition-colors"
      >
        Also delete all translation history
      </span>
    </label>

    <!-- Action buttons -->
    <div class="flex gap-2">
      <button
        type="button"
        class="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-surface transition-colors cursor-pointer"
        onclick={oncancel}
      >
        Cancel
      </button>
      <button
        type="button"
        class="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-colors cursor-pointer"
        onclick={() => onconfirm(deleteHistory)}
      >
        Sign Out
      </button>
    </div>
  </div>
</div>
