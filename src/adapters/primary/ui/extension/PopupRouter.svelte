<script lang="ts">
  import { createPopupNavigationController } from './PopupNavigationController.svelte';
  import HomePage from './pages/home/HomePage.svelte';
  import ManageKeysPage from './pages/manage-keys/ManageKeysPage.svelte';
  import ManageModelsPage from './pages/manage-models/ManageModelsPage.svelte';
  import CustomProvidersPage from './pages/custom-providers/CustomProvidersPage.svelte';
  import HistoryPage from './pages/history/HistoryPage.svelte';
  import SettingsPage from './pages/settings/SettingsPage.svelte';

  const controller = createPopupNavigationController();

  const currentView = $derived(controller.state.currentView);
</script>

<div
  class="view-container"
  class:slide-forward={controller.state.slideDirection === 'forward'}
  class:slide-back={controller.state.slideDirection === 'back'}
>
  {#key currentView}
    {#if currentView === 'manage-api-keys'}
      <ManageKeysPage
        onback={controller.showHome}
        initialProvider={controller.state.selectedProvider}
      />
    {:else if currentView === 'manage-models'}
      <ManageModelsPage
        onback={controller.showHome}
        initialProvider={controller.state.selectedProvider}
      />
    {:else if currentView === 'custom-providers'}
      <CustomProvidersPage onback={controller.showHome} />
    {:else if currentView === 'history'}
      <HistoryPage onback={controller.showHome} />
    {:else if currentView === 'settings'}
      <SettingsPage onback={controller.showHome} />
    {:else}
      <HomePage navigation={controller} />
    {/if}
  {/key}
</div>

<style>
  .view-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
  }

  .view-container.slide-forward > :global(:first-child) {
    animation: slide-in-left 0.2s ease-out;
  }

  .view-container.slide-back > :global(:first-child) {
    animation: slide-in-right 0.2s ease-out;
  }

  @keyframes slide-in-left {
    from {
      transform: translateX(30%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slide-in-right {
    from {
      transform: translateX(-30%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
</style>
