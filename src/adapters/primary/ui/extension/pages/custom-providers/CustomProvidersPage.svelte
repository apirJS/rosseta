<script lang="ts">
  import {
    getCustomProvidersStateContext,
    getPreferencesStateContext,
    getPopupToastContext,
  } from '../../../shared/context';
  import { Icon, ThemeToggle } from '../../../shared/components';
  import {
    createCustomProvidersController,
    type CustomProvidersDeps,
  } from './CustomProvidersController.svelte';
  import CustomProviderListItem from './components/CustomProviderListItem.svelte';

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

  const inputClass =
    'px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-primary';
</script>

<div class="flex flex-col h-full w-full bg-background">
  <div class="flex items-center p-4 pb-0 gap-2">
    <button
      type="button"
      class="flex items-center text-sm text-muted hover:text-foreground cursor-pointer"
      onclick={controller.state.view === 'form' ? controller.showList : onback}
      aria-label="Back"
    >
      <Icon name="arrow-left" class="w-4 h-4" />
    </button>
    <h2 class="flex-1 text-center text-base font-semibold text-foreground">
      {controller.state.view === 'form'
        ? controller.state.editingId
          ? 'Edit Provider'
          : 'New Provider'
        : 'Custom Providers'}
    </h2>
    <ThemeToggle
      isDark={preferences.state.resolvedTheme === 'dark'}
      onToggle={preferences.toggleTheme}
    />
  </div>

  {#if controller.state.view === 'list'}
    <div class="flex-1 flex flex-col px-4 py-3 min-h-0 overflow-hidden">
      <div class="flex flex-col gap-1.5 overflow-y-auto flex-1">
        {#each controller.providers as provider (provider.id)}
          <CustomProviderListItem
            {provider}
            onedit={controller.showEdit}
            onremove={(id) => controller.remove(id)}
          />
        {:else}
          <div class="flex-1 flex flex-col items-center justify-center gap-3 py-8">
            <p class="text-sm text-muted text-center">
              No custom providers yet. Add an OpenAI-compatible endpoint.
            </p>
          </div>
        {/each}
      </div>
    </div>

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
  {:else}
    <div class="flex-1 flex flex-col px-4 py-3 gap-3 overflow-y-auto">
      <p class="text-xs text-muted">
        OpenAI-compatible endpoint. API keys are managed under Manage API Keys.
      </p>

      <label class="flex flex-col gap-1">
        <span class="text-xs font-medium text-foreground">Name *</span>
        <input
          type="text"
          class={inputClass}
          placeholder="OpenRouter"
          bind:value={controller.state.name}
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-xs font-medium text-foreground">Base URL *</span>
        <input
          type="url"
          class={inputClass}
          placeholder="https://openrouter.ai/api/v1"
          bind:value={controller.state.baseURL}
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-xs font-medium text-foreground">
          Headers <span class="text-muted">(optional JSON)</span>
        </span>
        <textarea
          class="{inputClass} resize-none font-mono"
          placeholder='&#123;"HTTP-Referer": "https://rosseta.app"&#125;'
          rows="2"
          bind:value={controller.state.headers}
        ></textarea>
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-xs font-medium text-foreground">
          Query Params <span class="text-muted">(optional JSON)</span>
        </span>
        <textarea
          class="{inputClass} resize-none font-mono"
          placeholder='&#123;"api-version": "2024-02-01"&#125;'
          rows="2"
          bind:value={controller.state.queryParams}
        ></textarea>
      </label>

      {#if controller.state.error}
        <div
          class="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2"
        >
          {controller.state.error}
        </div>
      {/if}

      <div class="flex gap-2 pt-1">
        <button
          type="button"
          class="flex-1 px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground hover:bg-surface/80 cursor-pointer"
          onclick={controller.showList}
        >
          Cancel
        </button>
        <button
          type="button"
          class="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-fg text-sm font-medium hover:opacity-90 cursor-pointer disabled:opacity-50"
          onclick={() => controller.save()}
          disabled={controller.state.isSaving}
        >
          {controller.state.isSaving ? 'Saving…' : 'Save Provider'}
        </button>
      </div>
    </div>
  {/if}
</div>
