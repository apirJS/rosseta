<script lang="ts">
  import { Icon, EmptyState } from '../../../../shared/components';
  import type { CustomProviderConfig } from '../../../../../../../core/domain/provider/CustomProviderConfig';
  import CustomProviderListItem from './CustomProviderListItem.svelte';

  interface Props {
    providers: CustomProviderConfig[];
    onedit: (provider: CustomProviderConfig) => void;
    onremove: (id: string) => void;
  }

  const { providers, onedit, onremove }: Props = $props();
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="flex flex-col gap-1.5 overflow-y-auto flex-1">
    {#each providers as provider (provider.id)}
      <CustomProviderListItem {provider} {onedit} {onremove} />
    {:else}
      <EmptyState
        message="No custom providers yet. Add an OpenAI-compatible or Anthropic-compatible endpoint."
      />
    {/each}
  </div>
</div>
