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
  }

  const {
    value,
    oninput,
    onsubmit,
    isLoading = false,
    error = null,
  }: Props = $props();

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
    placeholder="Gemini or Groq API Key"
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
  Get <Link href="https://aistudio.google.com/apikey" external>Gemini</Link> or <Link
    href="https://console.groq.com/keys"
    external>Groq</Link
  > API key →
</p>
