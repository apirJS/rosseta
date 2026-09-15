<script lang="ts">
  import { Select } from '../../../../shared/components';
  import {
    getLanguageOptions,
    type LanguageCode,
  } from '../../../../shared/constants/languages';
  import { getBrowserLanguage } from '../../../../shared/hooks/usePreferences.svelte';

  interface Props {
    value: LanguageCode;
    onchange?: (value: LanguageCode) => void;
  }

  const { value, onchange }: Props = $props();

  const options = $derived(
    getLanguageOptions().map((lang) => ({
      value: lang.code,
      label: lang.name,
    })),
  );

  const effectiveValue = $derived.by(() => {
    const match = options.find((o) => o.value === value);
    if (match) return value;

    const browserLang = getBrowserLanguage();
    const browserMatch = options.find((o) => o.value === browserLang.code);
    if (browserMatch) return browserMatch.value as LanguageCode;

    const enMatch = options.find((o) => o.value === 'en-US');
    if (enMatch) return 'en-US' as LanguageCode;

    return options.length > 0 ? (options[0].value as LanguageCode) : value;
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
