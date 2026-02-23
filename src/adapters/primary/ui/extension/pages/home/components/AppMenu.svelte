<script lang="ts">
  interface Props {
    onLogout: () => void;
    onManageKeys: () => void;
    onProxySettings: () => void;
    onHistory: () => void;
  }

  const { onLogout, onManageKeys, onProxySettings, onHistory }: Props =
    $props();
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
      Proxy Settings
    </button>
    <button
      type="button"
      class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface cursor-pointer"
      onclick={onHistory}
    >
      History
    </button>
    <div class="border-t border-border my-1"></div>
    <button
      type="button"
      class="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-surface cursor-pointer"
      onclick={onLogout}
    >
      Logout
    </button>
  </div>
</div>
