<script lang="ts">
  import { clickOutside } from '../../../../shared/actions/clickOutside';
  import {
    Icon,
    ProviderSelector,
    ThemeToggle,
  } from '../../../../shared/components';
  import type { MenuDestination } from '../HomeController.svelte';
  import AppMenu from './AppMenu.svelte';

  interface Props {
    isMenuOpen: boolean;
    onToggleMenu: () => void;
    onCloseMenu: () => void;
    selectedProvider: string;
    onProviderChange: (value: string) => void;
    isDark: boolean;
    onToggleTheme: () => void;
    onNavigate: (destination: MenuDestination) => void;
  }

  const {
    isMenuOpen,
    onToggleMenu,
    onCloseMenu,
    selectedProvider,
    onProviderChange,
    isDark,
    onToggleTheme,
    onNavigate,
  }: Props = $props();
</script>

<div class="flex justify-between items-center p-4 pb-0">
  <div class="flex items-center gap-2 min-w-0">
    <div class="relative" use:clickOutside={onCloseMenu}>
      <button
        type="button"
        class="p-1 text-muted hover:text-foreground cursor-pointer"
        onclick={onToggleMenu}
        aria-label="Menu"
      >
        <Icon name="menu" class="w-5 h-5" />
      </button>
      {#if isMenuOpen}
        <AppMenu onnavigate={onNavigate} />
      {/if}
    </div>
    <div class="w-36 shrink-0">
      <ProviderSelector
        value={selectedProvider}
        compact
        onchange={onProviderChange}
      />
    </div>
  </div>
  <ThemeToggle {isDark} onToggle={onToggleTheme} />
</div>
