<script lang="ts">
  import {
    setAuthContext,
    setAuthStateContext,
    setPreferencesContext,
    setPreferencesStateContext,
    setTranslationContext,
    type AuthUseCases,
    type PreferencesUseCases,
    type TranslationUseCases,
  } from '../shared/context';
  import { useAuth } from '../shared/hooks/useAuth.svelte';
  import { usePreferences } from '../shared/hooks/usePreferences.svelte';
  import LoginPage from './pages/auth/LoginPage.svelte';
  import HomePage from './pages/home/HomePage.svelte';

  interface Props {
    authUseCases: AuthUseCases;
    preferencesUseCases: PreferencesUseCases;
    translationUseCases: TranslationUseCases;
  }

  const { authUseCases, preferencesUseCases, translationUseCases }: Props =
    $props();

  setAuthContext(authUseCases);
  setPreferencesContext(preferencesUseCases);
  setTranslationContext(translationUseCases);

  const auth = useAuth();
  setAuthStateContext(auth);

  const preferences = usePreferences(preferencesUseCases);
  setPreferencesStateContext(preferences);
</script>

{#if auth.state.isAuthenticated}
  <HomePage />
{:else}
  <LoginPage />
{/if}
