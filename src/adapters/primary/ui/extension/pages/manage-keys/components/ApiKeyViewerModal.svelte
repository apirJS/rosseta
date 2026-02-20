<script lang="ts">
  import { Icon } from '../../../../shared/components';

  interface Props {
    apiKey: string;
    onclose: () => void;
  }

  const { apiKey, onclose }: Props = $props();

  let copied = $state(false);

  async function copyToClipboard() {
    await navigator.clipboard.writeText(apiKey);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="fixed inset-0 z-50 flex items-center justify-center">
  <!-- Blur backdrop -->
  <button
    type="button"
    class="absolute inset-0 bg-black/60 backdrop-blur-sm border-none p-0 m-0 cursor-default"
    aria-label="Close modal"
    onclick={onclose}
  ></button>

  <!-- Modal content -->
  <div
    class="relative z-10 bg-background border border-border rounded-xl p-5 mx-4 max-w-[340px] w-full shadow-xl"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm font-semibold text-foreground">Full API Key</h3>
      <button
        type="button"
        class="p-1 text-muted hover:text-foreground transition-colors cursor-pointer"
        aria-label="Close"
        onclick={onclose}
      >
        <Icon name="x" class="w-4 h-4" />
      </button>
    </div>

    <!-- Key display -->
    <div class="flex items-start gap-2">
      <div
        class="flex-1 bg-surface border border-border rounded-lg p-3 text-sm text-foreground font-mono break-all select-all leading-relaxed"
      >
        {apiKey}
      </div>
      <button
        type="button"
        class="p-2 text-muted hover:text-foreground transition-colors cursor-pointer rounded-lg border border-border hover:border-primary/40 flex-shrink-0"
        aria-label="Copy API key"
        onclick={copyToClipboard}
      >
        {#if copied}
          <Icon name="check" class="w-4 h-4 text-primary" />
        {:else}
          <Icon name="copy" class="w-4 h-4" />
        {/if}
      </button>
    </div>
  </div>
</div>
