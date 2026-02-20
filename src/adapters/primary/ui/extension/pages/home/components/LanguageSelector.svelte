<script lang="ts">
  import { Select } from '../../../../shared/components';
  import {
    getLanguageOptions,
    type LanguageCode,
  } from '../../../../shared/constants/languages';
  import type { Provider } from '../../../../../../../core/domain/credential/Provider';
  import { getBrowserLanguage } from '../../../../shared/hooks/usePreferences.svelte';

  interface Props {
    value: LanguageCode;
    provider?: Provider;
    onchange?: (value: LanguageCode) => void;
  }

  const { value, provider, onchange }: Props = $props();

  const options = $derived(
    getLanguageOptions(provider).map((lang) => ({
      value: lang.code,
      label: lang.name,
    })),
  );

  // If current value isn't in the provider's supported list, fall back
  const effectiveValue = $derived.by(() => {
    const match = options.find((o) => o.value === value);
    if (match) return value;

    // Try browser language first
    const browserLang = getBrowserLanguage();
    const browserMatch = options.find((o) => o.value === browserLang.code);
    if (browserMatch) return browserMatch.value as LanguageCode;

    // Fall back to English
    const enMatch = options.find((o) => o.value === 'en-US');
    if (enMatch) return 'en-US' as LanguageCode;

    // Last resort: first available
    return options.length > 0 ? (options[0].value as LanguageCode) : value;
  });

  // Auto-select fallback when value doesn't match available options
  $effect(() => {
    if (effectiveValue !== value && options.length > 0) {
      onchange?.(effectiveValue);
    }
  });

  function handleChange(newValue: string) {
    onchange?.(newValue as LanguageCode);
  }
</script>

<Select
  id="language-select"
  label="Target Language"
  value={effectiveValue}
  {options}
  onchange={handleChange}
/>
