<script lang="ts">
  import {
    setAuthContext,
    setAuthStateContext,
    setPreferencesContext,
    setPreferencesStateContext,
    setTranslationContext,
    setModelsContext,
    setModelsStateContext,
    setCustomProvidersContext,
    setCustomProvidersStateContext,
    setPopupToastContext,
    type AuthUseCases,
    type PreferencesUseCases,
    type TranslationUseCases,
    type ModelUseCases,
    type CustomProviderUseCases,
  } from '../shared/context';
  import { useAuth } from '../shared/hooks/useAuth.svelte';
  import { usePreferences } from '../shared/hooks/usePreferences.svelte';
  import { useModels } from '../shared/hooks/useModels.svelte';
  import { useCustomProviders } from '../shared/hooks/useCustomProviders.svelte';
  import { PopupToastContainer } from '../shared/components';
  import { PopupToastController } from '../shared/toast/PopupToastController.svelte';
  import PopupRouter from './PopupRouter.svelte';

  interface Props {
    authUseCases: AuthUseCases;
    preferencesUseCases: PreferencesUseCases;
    translationUseCases: TranslationUseCases;
    modelUseCases: ModelUseCases;
    customProviderUseCases: CustomProviderUseCases;
  }

  const {
    authUseCases,
    preferencesUseCases,
    translationUseCases,
    modelUseCases,
    customProviderUseCases,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  setAuthContext(authUseCases);
  // svelte-ignore state_referenced_locally
  setPreferencesContext(preferencesUseCases);
  // svelte-ignore state_referenced_locally
  setTranslationContext(translationUseCases);
  // svelte-ignore state_referenced_locally
  setModelsContext(modelUseCases);
  // svelte-ignore state_referenced_locally
  setCustomProvidersContext(customProviderUseCases);
  // svelte-ignore state_referenced_locally
  setPopupToastContext(new PopupToastController());

  const auth = useAuth();
  setAuthStateContext(auth);

  // svelte-ignore state_referenced_locally
  const preferences = usePreferences(preferencesUseCases);
  setPreferencesStateContext(preferences);

  const models = useModels();
  setModelsStateContext(models);

  const customProviders = useCustomProviders();
  setCustomProvidersStateContext(customProviders);
</script>

<PopupRouter />
<PopupToastContainer />
