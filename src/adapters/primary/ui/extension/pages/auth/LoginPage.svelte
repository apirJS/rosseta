<script lang="ts">
  import {
    getAuthStateContext,
    getPreferencesStateContext,
  } from '../../../shared/context';
  import { PageShell } from '../../../shared/components';
  import AuthHeader from './components/AuthHeader.svelte';
  import ApiKeyInput from './components/ApiKeyInput.svelte';
  import { useProviderCycle } from '../../../shared/hooks/useProviderCycle.svelte';

  const { state: authState, addApiKey } = getAuthStateContext();
  const preferences = getPreferencesStateContext();
  const provider = useProviderCycle();

  let apiKeyInput = $state('');

  const subtitle = $derived(
    `Enter your ${provider.current.name} API key to get started`,
  );
</script>

<PageShell
  isDark={preferences.state.resolvedTheme === 'dark'}
  onToggleTheme={preferences.toggleTheme}
>
  <AuthHeader title="Rosseta" {subtitle} />

  <div class="mt-6">
    <ApiKeyInput
      value={apiKeyInput}
      oninput={(value) => (apiKeyInput = value)}
      onsubmit={() => addApiKey(apiKeyInput)}
      isLoading={authState.loading}
      error={authState.error}
      providerName={provider.current.name}
      providerApiKeyUrl={provider.current.apiKeyUrl}
    />
  </div>
</PageShell>
