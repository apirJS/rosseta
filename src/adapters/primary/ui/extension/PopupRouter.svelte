<script lang="ts">
  import { createHomeController } from './pages/home/HomeController.svelte';
  import HomePage from './pages/home/HomePage.svelte';
  import ManageKeysPage from './pages/manage-keys/ManageKeysPage.svelte';
  import ManageModelsPage from './pages/manage-models/ManageModelsPage.svelte';
  import CustomProvidersPage from './pages/custom-providers/CustomProvidersPage.svelte';
  import HistoryPage from './pages/history/HistoryPage.svelte';

  const controller = createHomeController();

  const currentView = $derived(controller.state.currentView);
</script>

<div
  class="view-container"
  class:slide-forward={controller.state.slideDirection === 'forward'}
  class:slide-back={controller.state.slideDirection === 'back'}
>
  {#key currentView}
    {#if currentView === 'manage-api-keys'}
      <ManageKeysPage onback={controller.showMain} />
    {:else if currentView === 'manage-models'}
      <ManageModelsPage onback={controller.showMain} />
    {:else if currentView === 'custom-providers'}
      <CustomProvidersPage onback={controller.showMain} />
    {:else if currentView === 'history'}
      <HistoryPage onback={controller.showMain} />
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
