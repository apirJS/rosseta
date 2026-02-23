<script lang="ts">
  import {
    Button,
    Input,
    FormError,
    Link,
  } from '../../../../shared/components';

  interface Props {
    value: string;
    oninput: (value: string) => void;
    onsubmit: () => void;
    isLoading?: boolean;
    error?: string | null;
    providerName: string;
    providerApiKeyUrl: string;
  }

  const {
    value,
    oninput,
    onsubmit,
    isLoading = false,
    error = null,
    providerName,
    providerApiKeyUrl,
  }: Props = $props();

  const placeholder = $derived(`${providerName} API Key`);

  function handleSubmit(e: Event) {
    e.preventDefault();
    onsubmit();
  }
</script>

<form class="w-full space-y-4" onsubmit={handleSubmit}>
  <Input
    id="api-key"
    type="password"
    label="API Key"
    {value}
    {oninput}
    {placeholder}
    disabled={isLoading}
  />

  <FormError message={error} />

  <Button
    type="submit"
    variant="primary"
    size="lg"
    class="w-full"
    {isLoading}
    disabled={!value.trim()}
  >
    Continue
  </Button>
</form>

<p class="text-xs text-muted mt-4 text-center">
  Get <Link href={providerApiKeyUrl} external>{providerName}</Link> API key →
</p>
