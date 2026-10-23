<script lang="ts">
  import { Icon } from '../../../../shared/components';

  interface Props {
    apiKey: string;
    copied: boolean;
    oncopy: () => void;
    onclose: () => void;
  }

  const { apiKey, copied, oncopy, onclose }: Props = $props();
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onclose()} />

<div class="fixed inset-0 z-50 flex items-center justify-center">
  <button
    type="button"
    class="absolute inset-0 bg-black/60 backdrop-blur-sm border-none p-0 m-0 cursor-default"
    aria-label="Close modal"
    onclick={onclose}
  ></button>

  <div
    class="relative z-10 bg-background border border-border rounded-xl p-5 mx-4 max-w-85 w-full shadow-xl"
  >
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

    <div class="flex items-start gap-2 min-w-0">
      <div
        class="flex-1 min-w-0 max-h-32 overflow-y-auto bg-surface border border-border rounded-lg p-3 text-sm text-foreground font-mono break-all select-all leading-relaxed"
      >
        {apiKey}
      </div>
      <button
        type="button"
        class="p-2 text-muted hover:text-foreground transition-colors cursor-pointer rounded-lg border border-border hover:border-primary/40 shrink-0"
        aria-label="Copy API key"
        onclick={oncopy}
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
