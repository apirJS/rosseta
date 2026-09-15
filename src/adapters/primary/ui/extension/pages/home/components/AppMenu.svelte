<script lang="ts">
  import browser from 'webextension-polyfill';
  import type { MenuDestination } from '../HomeController.svelte';

  interface Props {
    onnavigate: (destination: MenuDestination) => void;
  }

  const { onnavigate }: Props = $props();

  const version = browser.runtime.getManifest().version;
</script>

<div
  class="absolute top-full left-0 mt-1 bg-background border border-border rounded-md shadow-lg z-10 min-w-[160px]"
>
  <nav class="py-1">
    <button
      type="button"
      class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface cursor-pointer"
      onclick={() => onnavigate('manage-api-keys')}
    >
      Manage API Keys
    </button>
    <button
      type="button"
      class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface cursor-pointer"
      onclick={() => onnavigate('manage-models')}
    >
      Manage Models
    </button>
    <button
      type="button"
      class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface cursor-pointer"
      onclick={() => onnavigate('custom-providers')}
    >
      Custom Providers
    </button>
    <button
      type="button"
      class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface cursor-pointer"
      onclick={() => onnavigate('history')}
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
  </nav>
</div>
