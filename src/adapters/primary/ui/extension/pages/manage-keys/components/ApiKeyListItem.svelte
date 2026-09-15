<script lang="ts">
  import { Icon } from '../../../../shared/components';
  import { maskApiKey } from '../../../../shared/utils';
  import { PROVIDER_BADGE_COLORS } from '../../../../shared/constants/providers';
  import type { Credential } from '../../../../../../../core/domain/credential/Credential';
  import { ProviderRegistry } from '../../../../../../../core/domain/provider/ProviderRegistry';

  interface Props {
    credential: Credential;
    isActive: boolean;
    onSetActive: () => void;
    onDelete: () => void;
    onView: () => void;
  }

  const { credential, isActive, onSetActive, onDelete, onView }: Props =
    $props();

  const maskedKey = $derived(maskApiKey(credential.apiKey.value));

  const providerLabel = $derived(
    ProviderRegistry.getConfig(credential.provider).name.toUpperCase(),
  );

  const badgeColor = $derived(
    PROVIDER_BADGE_COLORS[credential.provider] ??
      PROVIDER_BADGE_COLORS['custom-provider'],
  );
</script>

<div
  class="flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors {isActive
    ? 'bg-surface border-primary/50'
    : 'bg-surface border-border'}"
>
  <span
    class="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded {badgeColor}"
  >
    {providerLabel}
  </span>

  <button
    type="button"
    class="flex-1 text-sm text-foreground truncate text-left cursor-pointer hover:text-primary transition-colors"
    onclick={onSetActive}
    title="Set as active key"
  >
    {maskedKey}
  </button>

  {#if isActive}
    <span class="text-[10px] text-primary font-medium">ACTIVE</span>
  {/if}

  <button
    type="button"
    class="p-1 text-muted hover:text-foreground transition-colors cursor-pointer"
    aria-label="View full API key"
    onclick={onView}
  >
    <Icon name="eye" class="w-4 h-4" />
  </button>

  <button
    type="button"
    class="p-1 text-muted hover:text-destructive transition-colors cursor-pointer"
    aria-label="Delete API key"
    onclick={onDelete}
  >
    <Icon name="trash" class="w-4 h-4" />
  </button>
</div>
