<script lang="ts">
  import { Button } from '../../../../shared/components';
  import { getPreferencesStateContext } from '../../../../shared/context';

  interface Props {
    onclick?: () => void;
    disabled?: boolean;
    isLoading?: boolean;
  }

  const { onclick, disabled = false, isLoading = false }: Props = $props();
  const preferences = getPreferencesStateContext();

  const shortcutLabel = $derived(preferences.state.shortcut);
</script>

<Button
  variant="primary"
  size="lg"
  class="w-full flex-col py-3"
  {onclick}
  {disabled}
  {isLoading}
>
  <span class="font-semibold">Translate</span>
  {#if shortcutLabel}
    <span class="text-xs opacity-80">({shortcutLabel})</span>
  {:else}
    <span class="text-xs opacity-60">Shortcut not set</span>
  {/if}
</Button>
