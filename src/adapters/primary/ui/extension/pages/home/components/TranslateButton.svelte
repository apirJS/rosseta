<script lang="ts">
  import { Button } from '../../../../shared/components';

  interface Props {
    onclick?: () => void;
    disabled?: boolean;
    isLoading?: boolean;
    shortcutSettingsUrl: string;
    onOpenShortcutSettings: () => void;
    shortcutLabel: string | null;
  }

  const {
    onclick,
    disabled = false,
    isLoading = false,
    shortcutSettingsUrl,
    onOpenShortcutSettings,
    shortcutLabel,
  }: Props = $props();
</script>

<div class="relative">
  <Button
    variant="primary"
    size="lg"
    class="w-full flex-col py-3 select-none"
    {onclick}
    {disabled}
    {isLoading}
  >
    <span class="font-semibold">Translate</span>
    {#if shortcutLabel}
      <span class="text-xs opacity-80">({shortcutLabel})</span>
    {:else}
      <span class="h-4 shrink-0" aria-hidden="true"></span>
    {/if}
  </Button>
  {#if !shortcutLabel && !isLoading}
    <a
      href={shortcutSettingsUrl}
      target="_blank"
      rel="noopener noreferrer"
      class="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-primary-fg/70 underline underline-offset-2 hover:text-primary-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      onclick={(event) => {
        event.preventDefault();
        onOpenShortcutSettings();
      }}>Shortcut not set</a
    >
  {/if}
</div>
