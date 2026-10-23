<script lang="ts">
  import { Select } from '../../../../shared/components';
  import {
    getLanguageOptions,
    type LanguageCode,
  } from '../../../../shared/constants/languages';

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

  function handleChange(newValue: string) {
    onchange?.(newValue as LanguageCode);
  }
</script>

<Select
  id="language-select"
  label="Target Language"
  {value}
  {options}
  onchange={handleChange}
/>
