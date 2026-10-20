<script lang="ts">
  import Select from './Select.svelte';
  import { getCustomProvidersStateContext } from '../context';
  import { PROVIDERS } from '../../../../../core/domain/credential/Provider';
  import { getProviderDefinition } from '../../../../../core/domain/provider/provider-definitions';

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
      label: getProviderDefinition(id)!.name,
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
