<script lang="ts">
  import { clickOutside } from '../../../../shared/actions/clickOutside';
  import { Icon } from '../../../../shared/components';
  import type { Credential } from '../../../../../../../core/domain/credential/Credential';
  import type { AnyProvider } from '../../../../../../../core/domain/credential/Provider';
  import type { KeySelectionMode } from '../../../../../../../core/domain/credential/KeySelectionMode';
  import KeySelectorDropdown from './KeySelectorDropdown.svelte';

  interface Props {
    credentials: Credential[];
    activeCredentialId: string | null;
    currentMode: KeySelectionMode;
    autoBalanceProviders: AnyProvider[];
    isOpen: boolean;
    label: string;
    disabled?: boolean;
    onToggle: () => void;
    onClose: () => void;
    onSelectKey: (credential: Credential) => void;
    onSelectAutoBalance: (provider: AnyProvider) => void;
  }

  const {
    credentials,
    activeCredentialId,
    currentMode,
    autoBalanceProviders,
    isOpen,
    label,
    disabled = false,
    onToggle,
    onClose,
    onSelectKey,
    onSelectAutoBalance,
  }: Props = $props();
</script>

<div>
  <span class="block text-sm font-medium text-foreground mb-1"> API Key </span>

  {#if credentials.length > 1}
    <div class="relative" use:clickOutside={onClose}>
      <button
        type="button"
        class="w-full flex items-center px-3 py-2 pr-8 rounded-md border border-border bg-background
               text-sm text-foreground text-left cursor-pointer select-none
               focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
               hover:border-primary/50 transition-colors"
        onclick={onToggle}
        {disabled}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span class="truncate">{label}</span>
        <span
          class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"
        >
          <Icon
            name="chevron-down"
            class="w-4 h-4 text-foreground shrink-0 transition-transform {isOpen
              ? 'rotate-180'
              : ''}"
          />
        </span>
      </button>

      {#if isOpen && !disabled}
        <KeySelectorDropdown
          {credentials}
          {activeCredentialId}
          {currentMode}
          {autoBalanceProviders}
          {onSelectKey}
          {onSelectAutoBalance}
        />
      {/if}
    </div>
  {:else if credentials.length === 1}
    <div
      class="w-full flex items-center px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground select-none"
    >
      <span class="truncate">
        {label}
      </span>
    </div>
  {:else}
    <div
      class="w-full flex items-center px-3 py-2 rounded-md border border-border bg-background text-sm text-muted select-none opacity-50 cursor-not-allowed"
    >
      —
    </div>
  {/if}
</div>
