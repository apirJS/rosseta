<script lang="ts">
  import browser from 'webextension-polyfill';

  interface Props {
    onLogout: () => void;
    onManageKeys: () => void;
    onProxySettings: () => void;
    onHistory: () => void;
    proxyActive?: boolean;
  }

  const {
    onLogout,
    onManageKeys,
    onProxySettings,
    onHistory,
    proxyActive = false,
  }: Props = $props();

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
      onclick={onProxySettings}
    >
      <span class="inline-flex items-center gap-1.5">
        Proxy Settings
        {#if proxyActive}
          <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
        {/if}
      </span>
    </button>
    <button
      type="button"
      class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface cursor-pointer"
      onclick={onHistory}
    >
      History
    </button>
    <button
      type="button"
      class="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-surface cursor-pointer"
      onclick={onLogout}
    >
      Logout
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
