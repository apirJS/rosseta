<script lang="ts">
  interface Props {
    name: string;
    baseURL: string;
    headers: string;
    queryParams: string;
    error: string | null;
    isSaving: boolean;
    onsave: () => void;
    oncancel: () => void;
  }

  let {
    name = $bindable(),
    baseURL = $bindable(),
    headers = $bindable(),
    queryParams = $bindable(),
    error,
    isSaving,
    onsave,
    oncancel,
  }: Props = $props();

  const inputClass =
    'px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-primary';
</script>

<div class="flex-1 flex flex-col gap-3 overflow-y-auto">
  <p class="text-xs text-muted">
    OpenAI-compatible endpoint. API keys are managed under Manage API Keys.
  </p>

  <label class="flex flex-col gap-1">
    <span class="text-xs font-medium text-foreground">Name *</span>
    <input
      type="text"
      class={inputClass}
      placeholder="OpenRouter"
      bind:value={name}
    />
  </label>

  <label class="flex flex-col gap-1">
    <span class="text-xs font-medium text-foreground">Base URL *</span>
    <input
      type="url"
      class={inputClass}
      placeholder="https://openrouter.ai/api/v1"
      bind:value={baseURL}
    />
  </label>

  <label class="flex flex-col gap-1">
    <span class="text-xs font-medium text-foreground">
      Headers <span class="text-muted">(optional JSON)</span>
    </span>
    <textarea
      class="{inputClass} resize-none font-mono"
      placeholder='&#123;"HTTP-Referer": "https://rosseta.app"&#125;'
      rows="2"
      bind:value={headers}
    ></textarea>
  </label>

  <label class="flex flex-col gap-1">
    <span class="text-xs font-medium text-foreground">
      Query Params <span class="text-muted">(optional JSON)</span>
    </span>
    <textarea
      class="{inputClass} resize-none font-mono"
      placeholder='&#123;"api-version": "2024-02-01"&#125;'
      rows="2"
      bind:value={queryParams}
    ></textarea>
  </label>

  {#if error}
    <div
      class="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2"
    >
      {error}
    </div>
  {/if}

  <div class="flex gap-2 pt-1">
    <button
      type="button"
      class="flex-1 px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground hover:bg-surface/80 cursor-pointer"
      onclick={oncancel}
    >
      Cancel
    </button>
    <button
      type="button"
      class="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-fg text-sm font-medium hover:opacity-90 cursor-pointer disabled:opacity-50"
      onclick={onsave}
      disabled={isSaving}
    >
      {isSaving ? 'Saving…' : 'Save Provider'}
    </button>
  </div>
</div>
