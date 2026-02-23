<script lang="ts">
  import { getPreferencesStateContext } from '../../../shared/context';
  import { Icon, ThemeToggle } from '../../../shared/components';

  interface Props {
    onback: () => void;
  }

  const { onback }: Props = $props();
  const preferences = getPreferencesStateContext();

  let proxyInput = $state(preferences.state.proxyUrl ?? '');
  let healthStatus = $state<'idle' | 'checking' | 'ok' | 'error'>('idle');
  let saveError = $state(false);
  let saving = $state(false);

  async function handleSave() {
    const trimmed = proxyInput.trim();
    const url = trimmed || null;
    saveError = false;

    if (url) {
      saving = true;
      healthStatus = 'checking';
      const result = await preferences.checkProxyHealth(url);
      const healthy = result.success && result.data;
      healthStatus = healthy ? 'ok' : 'error';
      saving = false;

      if (!healthy) {
        saveError = true;
        setTimeout(() => (saveError = false), 2000);
        return;
      }
    } else {
      healthStatus = 'idle';
    }

    await preferences.setProxyUrl(url);
  }

  async function handleClear() {
    proxyInput = '';
    await preferences.setProxyUrl(null);
    healthStatus = 'idle';
    saveError = false;
  }

  async function handleHealthCheck() {
    const trimmed = proxyInput.trim();
    if (!trimmed) return;

    healthStatus = 'checking';
    const result = await preferences.checkProxyHealth(trimmed);
    healthStatus = result.success && result.data ? 'ok' : 'error';
  }
</script>

<div class="flex flex-col h-full w-full bg-background">
  <!-- Header -->
  <div class="flex items-center p-4 pb-0">
    <button
      type="button"
      class="flex items-center text-sm text-muted hover:text-foreground cursor-pointer"
      onclick={onback}
    >
      <Icon name="arrow-left" class="w-4 h-4 mr-1" />
    </button>
    <h2 class="flex-1 text-center text-base font-semibold text-foreground">
      Proxy Settings
    </h2>
    <ThemeToggle
      isDark={preferences.state.resolvedTheme === 'dark'}
      onToggle={preferences.toggleTheme}
    />
  </div>

  <!-- Content -->
  <div class="flex-1 flex flex-col px-4 py-4 min-h-0 overflow-hidden">
    <label for="proxy-url" class="text-sm font-medium text-foreground mb-1">
      Proxy URL
    </label>
    <input
      id="proxy-url"
      type="url"
      class="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-primary"
      placeholder="https://your-proxy.example.com"
      bind:value={proxyInput}
    />
    <p class="text-xs text-muted mt-1">
      All API requests will be routed through this URL. Leave empty for direct
      connections.
    </p>

    <!-- Actions -->
    <div class="flex gap-2 mt-4">
      <button
        type="button"
        class="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-fg text-sm font-medium hover:opacity-90 cursor-pointer"
        onclick={handleSave}
        disabled={saving}
      >
        {#if saving}Checking...{:else if saveError}✗ Unhealthy{:else}Save{/if}
      </button>
      <button
        type="button"
        class="px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm font-medium hover:opacity-90 cursor-pointer"
        onclick={handleClear}
        disabled={!proxyInput.trim()}
      >
        Clear
      </button>
    </div>

    <!-- Health Check -->
    <div class="mt-4 flex items-center gap-2">
      <button
        type="button"
        class="px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm font-medium hover:opacity-90 cursor-pointer"
        onclick={handleHealthCheck}
        disabled={!proxyInput.trim() || healthStatus === 'checking'}
      >
        {healthStatus === 'checking' ? 'Checking...' : 'Health Check'}
      </button>

      {#if healthStatus === 'ok'}
        <span class="text-sm text-green-500 font-medium">✓ Connected</span>
      {:else if healthStatus === 'error'}
        <span class="text-sm text-destructive font-medium">✗ Unreachable</span>
      {/if}
    </div>
  </div>
</div>
