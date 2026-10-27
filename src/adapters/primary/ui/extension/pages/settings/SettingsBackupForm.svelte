<script lang="ts">
  interface Props {
    exporting: boolean;
    importing: boolean;
    onexport: () => void;
    onimport: (file: File) => Promise<void>;
  }

  const { exporting, importing, onexport, onimport }: Props = $props();
  let fileInput: HTMLInputElement | undefined;

  async function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    try {
      if (file) await onimport(file);
    } finally {
      input.value = '';
    }
  }
</script>

<div class="flex-1 overflow-y-auto flex flex-col gap-3">
  <section class="rounded-lg border border-border bg-surface p-4">
    <h3 class="text-sm font-semibold text-foreground">Export Settings</h3>
    <p class="mt-1 text-xs leading-relaxed text-muted">
      Download a JSON backup containing API keys, custom providers, models,
      language and model preferences, theme, key rotation settings, and
      translation history.
    </p>
    <button
      type="button"
      class="mt-3 w-full px-3 py-2 rounded-lg bg-primary text-primary-fg text-sm font-medium hover:opacity-90 cursor-pointer disabled:opacity-50"
      disabled={exporting || importing}
      onclick={onexport}
    >
      {exporting ? 'Exporting…' : 'Export Settings'}
    </button>
  </section>

  <section class="rounded-lg border border-border bg-surface p-4">
    <h3 class="text-sm font-semibold text-foreground">Import Settings</h3>
    <p class="mt-1 text-xs leading-relaxed text-muted">
      Restore a Rosseta JSON backup. Imported values replace your current API
      keys, custom providers, models, and preferences. Translation history is
      replaced only when the backup includes it.
    </p>
    <input
      bind:this={fileInput}
      class="hidden"
      type="file"
      accept="application/json,.json"
      onchange={handleFileChange}
    />
    <button
      type="button"
      class="mt-3 w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm font-medium text-foreground hover:bg-background cursor-pointer disabled:opacity-50"
      disabled={exporting || importing}
      onclick={() => fileInput?.click()}
    >
      {importing ? 'Importing…' : 'Import Settings'}
    </button>
  </section>

  <p class="px-1 text-xs leading-relaxed text-muted">
    Settings files contain your API keys in plain text. Store them somewhere
    private.
  </p>
</div>
