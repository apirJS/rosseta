<script lang="ts">
  import { clickOutside } from '../../../../shared/actions/clickOutside';
  import { Icon } from '../../../../shared/components';
  import {
    getAuthStateContext,
    getPopupToastContext,
  } from '../../../../shared/context';
  import type { Credential } from '../../../../../../../core/domain/credential/Credential';
  import type { AnyProvider } from '../../../../../../../core/domain/credential/Provider';
  import { createActiveKeyIndicatorController } from './ActiveKeyIndicatorController.svelte';
  import KeySelectorDropdown from './KeySelectorDropdown.svelte';

  interface Props {
    provider: AnyProvider;
    credential: Credential | null;
  }

  const { provider, credential }: Props = $props();

  const auth = getAuthStateContext();
  const toast = getPopupToastContext();

  const controller = createActiveKeyIndicatorController({
    getProvider: () => provider,
    getCredential: () => credential,
    auth,
    toast,
  });
</script>

<div>
  <span class="block text-sm font-medium text-foreground mb-1">
    API Key
  </span>

  {#if controller.hasMultiple}
    <div class="relative" use:clickOutside={controller.close}>
      <button
        type="button"
        class="w-full flex items-center px-3 py-2 pr-8 rounded-md border border-border bg-background
               text-sm text-foreground text-left cursor-pointer select-none
               focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
               hover:border-primary/50 transition-colors"
        onclick={controller.toggle}
        aria-haspopup="true"
        aria-expanded={controller.state.isOpen}
      >
        <span class="truncate">{controller.getTriggerLabel()}</span>
        <span
          class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"
        >
          <Icon
            name="chevron-down"
            class="w-4 h-4 text-foreground flex-shrink-0 transition-transform {controller
              .state.isOpen
              ? 'rotate-180'
              : ''}"
          />
        </span>
      </button>

      {#if controller.state.isOpen}
        <KeySelectorDropdown
          credentials={controller.providerCredentials}
          activeCredentialId={controller.providerActive?.id ?? null}
          currentMode={controller.currentMode}
          autoBalanceProviders={controller.autoBalanceProviders}
          onSelectKey={controller.selectKey}
          onSelectAutoBalance={controller.selectAutoBalance}
        />
      {/if}
    </div>
  {:else if controller.providerCredentials.length === 1}
    <div
      class="w-full flex items-center px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground select-none"
    >
      <span class="truncate">
        {controller.getDisplayLabel(controller.providerCredentials[0])}
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
