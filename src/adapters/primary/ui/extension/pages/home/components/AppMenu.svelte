<script lang="ts">
  import browser from 'webextension-polyfill';

  interface Props {
    onManageKeys: () => void;
    onManageModels: () => void;
    onCustomProviders: () => void;
    onHistory: () => void;
  }

  const { onManageKeys, onManageModels, onCustomProviders, onHistory }: Props =
    $props();

  const version = browser.runtime.getManifest().version;
</script>

<div
  class="absolute top-full left-0 mt-1 bg-background border border-border rounded-md shadow-lg z-10 min-w-[160px]"
>
  <div class="py-1">
    <button
      type="button"
      class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface cursor-pointer"
      onclick={onManageKeys}
    >
      Manage API Keys
    </button>
    <button
      type="button"
      class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface cursor-pointer"
      onclick={onManageModels}
    >
      Manage Models
    </button>
    <button
      type="button"
      class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface cursor-pointer"
      onclick={onCustomProviders}
    >
      Custom Providers
    </button>
    <button
      type="button"
      class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface cursor-pointer"
      onclick={onHistory}
    >
      History
    </button>
    <div class="border-t border-border my-1"></div>
    <div
      class="px-3 py-1.5 text-xs text-muted flex items-center justify-between"
    >
      <span>v{version}</span>
      <a
        href="https://github.com/apirJS/rosseta"
        target="_blank"
        rel="noopener noreferrer"
        class="text-muted hover:text-foreground transition-colors"
      >
        GitHub
      </a>
    </div>
  </div>
</div>
