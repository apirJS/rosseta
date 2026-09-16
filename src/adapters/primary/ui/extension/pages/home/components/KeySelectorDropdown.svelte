<script lang="ts">
  import { Icon } from '../../../../shared/components';
  import { maskApiKey } from '../../../../shared/utils';
  import type { Credential } from '../../../../../../../core/domain/credential/Credential';
  import type { KeySelectionMode } from '../../../../../../../core/domain/credential/KeySelectionMode';
  import type { AnyProvider } from '../../../../../../../core/domain/credential/Provider';

  interface Props {
    credentials: readonly Credential[];
    activeCredentialId: string | null;
    currentMode: KeySelectionMode;
    autoBalanceProviders: AnyProvider[];
    onSelectKey: (credential: Credential) => void;
    onSelectAutoBalance: (provider: AnyProvider) => void;
  }

  const {
    credentials,
    activeCredentialId,
    currentMode,
    autoBalanceProviders,
    onSelectKey,
    onSelectAutoBalance,
  }: Props = $props();
</script>

<div
  class="absolute top-full left-0 mt-1 w-full py-1
         bg-background border border-border rounded-md shadow-lg z-50
         max-h-[180px] overflow-y-auto"
>
  {#if autoBalanceProviders.length > 0}
    {#each autoBalanceProviders as provider (provider)}
      {@const isActive = currentMode.value === `auto-balance:${provider}`}
      <button
        type="button"
        aria-pressed={isActive}
        class="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left
               {isActive ? 'text-foreground' : 'text-muted hover:text-foreground'}
               hover:bg-surface cursor-pointer"
        onclick={() => onSelectAutoBalance(provider)}
      >
        <span class="truncate">Auto balance ⟳</span>
        {#if isActive}
          <Icon name="check" class="w-4 h-4 text-primary shrink-0" />
        {:else}
          <span class="w-4 shrink-0"></span>
        {/if}
      </button>
    {/each}

    <div class="border-t border-border my-1"></div>
  {/if}

  {#each credentials as cred (cred.id)}
    {@const isActive = currentMode.isManual && cred.id === activeCredentialId}
    <button
      type="button"
      aria-pressed={isActive}
      class="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left
             {isActive ? 'text-foreground' : 'text-muted hover:text-foreground'}
             hover:bg-surface cursor-pointer"
      onclick={() => onSelectKey(cred)}
    >
      <span class="truncate font-mono text-xs">
        {maskApiKey(cred.apiKey.value)}
      </span>
      {#if isActive}
        <Icon name="check" class="w-4 h-4 text-primary shrink-0" />
      {:else}
        <span class="w-4 shrink-0"></span>
      {/if}
    </button>
  {/each}
</div>
