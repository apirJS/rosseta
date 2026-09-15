<script lang="ts">
  import { Icon } from '../../../../shared/components';
  import type { CustomProviderConfig } from '../../../../../../../core/domain/provider/CustomProviderConfig';

  interface Props {
    provider: CustomProviderConfig;
    onedit: (provider: CustomProviderConfig) => void;
    onremove: (id: string) => void;
  }

  const { provider, onedit, onremove }: Props = $props();
</script>

<div
  class="group flex items-center rounded-lg border border-border bg-surface"
>
  <button
    type="button"
    class="flex-1 flex flex-col gap-0.5 min-w-0 px-3 py-2 text-left cursor-pointer"
    onclick={() => onedit(provider)}
    title="Edit provider"
  >
    <span class="text-sm text-foreground truncate">{provider.name}</span>
    <span class="text-xs text-muted truncate">{provider.baseURL}</span>
  </button>
  <button
    type="button"
    class="text-muted hover:text-destructive cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2 mr-2"
    onclick={() => onremove(provider.id)}
    title="Remove provider"
  >
    <Icon name="trash" class="w-4 h-4" />
  </button>
</div>
