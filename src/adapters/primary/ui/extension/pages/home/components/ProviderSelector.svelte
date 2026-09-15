<script lang="ts">
  import { Select } from '../../../../shared/components';
  import {
    getCustomProvidersStateContext,
  } from '../../../../shared/context';
  import { PROVIDERS } from '../../../../../../../core/domain/credential/Provider';
  import { ProviderRegistry } from '../../../../../../../core/domain/provider/ProviderRegistry';

  interface Props {
    value: string;
    compact?: boolean;
    onchange?: (value: string) => void;
  }

  const { value, compact = false, onchange }: Props = $props();

  const customProviders = getCustomProvidersStateContext();

  const options = $derived([
    ...PROVIDERS.map((id) => ({
      value: id,
      label: ProviderRegistry.getConfig(id).name,
    })),
    ...customProviders.state.providers.map((provider) => ({
      value: provider.id,
      label: provider.name,
    })),
  ]);
</script>

<Select
  id="provider-select"
  label={compact ? undefined : 'Provider'}
  {value}
  {options}
  onchange={(newValue) => onchange?.(newValue)}
/>
