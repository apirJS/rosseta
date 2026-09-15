<script lang="ts">
  import {
    getCustomProvidersStateContext,
    getPreferencesStateContext,
    getPopupToastContext,
  } from '../../../shared/context';
  import { Icon, PageShell } from '../../../shared/components';
  import {
    createCustomProvidersController,
    type CustomProvidersDeps,
  } from './CustomProvidersController.svelte';
  import CustomProviderList from './components/CustomProviderList.svelte';
  import CustomProviderForm from './components/CustomProviderForm.svelte';

  interface Props {
    onback: () => void;
  }

  const { onback }: Props = $props();

  const customProviders = getCustomProvidersStateContext();
  const preferences = getPreferencesStateContext();
  const toast = getPopupToastContext();

  const deps: CustomProvidersDeps = {
    providers: () => customProviders.state.providers,
    save: (props) => customProviders.save(props),
    remove: (id) => customProviders.remove(id),
    toast,
  };

  const controller = createCustomProvidersController(deps);

  const title = $derived(
    controller.state.view === 'form'
      ? controller.state.editingId
        ? 'Edit Provider'
        : 'New Provider'
      : 'Custom Providers',
  );
</script>

<PageShell
  onback={controller.state.view === 'form' ? controller.showList : onback}
  {title}
  isDark={preferences.state.resolvedTheme === 'dark'}
  onToggleTheme={preferences.toggleTheme}
>
  {#if controller.state.view === 'list'}
    <CustomProviderList
      providers={controller.providers}
      onedit={controller.showEdit}
      onremove={(id) => controller.remove(id)}
    />
  {:else}
    <CustomProviderForm
      bind:name={controller.state.name}
      bind:baseURL={controller.state.baseURL}
      bind:headers={controller.state.headers}
      bind:queryParams={controller.state.queryParams}
      error={controller.state.error}
      isSaving={controller.state.isSaving}
      onsave={() => controller.save()}
      oncancel={controller.showList}
    />
  {/if}

  {#snippet footer()}
    {#if controller.state.view === 'list'}
      <div class="flex items-center px-4 py-3 border-t border-border">
        <button
          type="button"
          class="w-full px-3 py-2 rounded-lg bg-primary text-primary-fg text-sm font-medium hover:opacity-90 cursor-pointer flex items-center justify-center gap-1.5"
          onclick={controller.showCreate}
        >
          <Icon name="plus" class="w-4 h-4" />
          Add Provider
        </button>
      </div>
    {/if}
  {/snippet}
</PageShell>
