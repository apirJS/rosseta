<script lang="ts">
  import {
    getAuthStateContext,
    getPreferencesStateContext,
  } from '../../../shared/context';
  import { PageShell } from '../../../shared/components';
  import AuthHeader from './components/AuthHeader.svelte';
  import ApiKeyInput from './components/ApiKeyInput.svelte';

  const { state: authState, addApiKey } = getAuthStateContext();
  const preferences = getPreferencesStateContext();

  let apiKeyInput = $state('');
</script>

<PageShell
  isDark={preferences.state.resolvedTheme === 'dark'}
  onToggleTheme={preferences.toggleTheme}
>
  <AuthHeader
    title="Rosseta"
    subtitle="Enter your Gemini or Groq API key to get started"
  />

  <div class="mt-6">
    <ApiKeyInput
      value={apiKeyInput}
      oninput={(value) => (apiKeyInput = value)}
      onsubmit={() => addApiKey(apiKeyInput)}
      isLoading={authState.loading}
      error={authState.error}
    />
  </div>
</PageShell>
