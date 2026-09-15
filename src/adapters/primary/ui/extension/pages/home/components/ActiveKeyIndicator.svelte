<script lang="ts">
  import { Icon } from '../../../../shared/components';
  import { getAuthStateContext, getPopupToastContext } from '../../../../shared/context';
  import { maskApiKey } from '../../../../shared/utils';
  import type { Credential } from '../../../../../../../core/domain/credential/Credential';
  import type { AnyProvider } from '../../../../../../../core/domain/credential/Provider';
  import { KeySelectionMode } from '../../../../../../../core/domain/credential/KeySelectionMode';
  import KeySelectorDropdown from './KeySelectorDropdown.svelte';

  interface Props {
    provider: AnyProvider;
    credential: Credential | null;
  }

  const { provider, credential }: Props = $props();
  const auth = getAuthStateContext();
  const toast = getPopupToastContext();

  const providerCredentials = $derived(
    (auth.state.credentials?.items ?? []).filter(
      (c) => c.provider === provider,
    ),
  );
  const hasMultiple = $derived(providerCredentials.length > 1);
  const currentMode = $derived(auth.state.keySelectionMode);

  const providerActive = $derived(
    credential && credential.provider === provider ? credential : null,
  );

  const autoBalanceProviders = $derived(
    providerCredentials.length >= 2 ? [provider] : [],
  );

  let isOpen = $state(false);
  let triggerEl = $state<HTMLButtonElement>();
  let popoverEl = $state<HTMLDivElement>();

  function getDisplayLabel(cred: Credential): string {
    return maskApiKey(cred.apiKey.value);
  }

  function getTriggerLabel(): string {
    if (
      currentMode.isAutoBalance &&
      currentMode.autoBalanceProvider === provider
    ) {
      return 'Auto ⟳';
    }
    if (providerActive) return getDisplayLabel(providerActive);
    return '—';
  }

  async function selectKey(cred: Credential) {
    if (!currentMode.isManual) {
      await auth.setKeySelectionMode(KeySelectionMode.manual());
    }
    await auth.setActiveKey(cred.id);
    isOpen = false;
  }

  async function selectAutoBalance(targetProvider: AnyProvider) {
    const error = await auth.setKeySelectionMode(
      KeySelectionMode.autoBalance(targetProvider),
    );
    if (error) {
      toast.show({
        type: 'error',
        message: 'Could not enable auto-balance',
        description: error,
      });
    }
    isOpen = false;
  }

  $effect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: PointerEvent) {
      const target = e.target as Node;
      if (
        triggerEl &&
        !triggerEl.contains(target) &&
        popoverEl &&
        !popoverEl.contains(target)
      ) {
        isOpen = false;
      }
    }

    document.addEventListener('pointerdown', handleClickOutside);
    return () =>
      document.removeEventListener('pointerdown', handleClickOutside);
  });
</script>

<div>
  <span class="block text-sm font-medium text-foreground mb-1">
    API Key
  </span>

  {#if hasMultiple}
    <div class="relative">
      <button
        type="button"
        bind:this={triggerEl}
        class="w-full flex items-center px-3 py-2 pr-8 rounded-md border border-border bg-background
               text-sm text-foreground text-left cursor-pointer select-none
               focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
               hover:border-primary/50 transition-colors"
        onclick={() => (isOpen = !isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span class="truncate">{getTriggerLabel()}</span>
        <span
          class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"
        >
          <Icon
            name="chevron-down"
            class="w-4 h-4 text-foreground flex-shrink-0 transition-transform {isOpen
              ? 'rotate-180'
              : ''}"
          />
        </span>
      </button>

      {#if isOpen}
        <div bind:this={popoverEl}>
          <KeySelectorDropdown
            credentials={providerCredentials}
            activeCredentialId={providerActive?.id ?? null}
            {currentMode}
            {autoBalanceProviders}
            onSelectKey={selectKey}
            onSelectAutoBalance={selectAutoBalance}
          />
        </div>
      {/if}
    </div>
  {:else if providerCredentials.length === 1}
    <div
      class="w-full flex items-center px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground select-none"
    >
      <span class="truncate">{getDisplayLabel(providerCredentials[0])}</span>
    </div>
  {:else}
    <div
      class="w-full flex items-center px-3 py-2 rounded-md border border-border bg-background text-sm text-muted select-none opacity-50 cursor-not-allowed"
    >
      —
    </div>
  {/if}
</div>
