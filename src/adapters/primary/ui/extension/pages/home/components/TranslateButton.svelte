<script lang="ts">
  import { Button } from '../../../../shared/components';

  interface Props {
    onclick?: () => void;
    disabled?: boolean;
    isLoading?: boolean;
  }

  const { onclick, disabled = false, isLoading = false }: Props = $props();
</script>

<Button
  variant="primary"
  size="lg"
  class="w-full flex-col py-3"
  {onclick}
  {disabled}
  {isLoading}
>
  <span class="font-semibold">Translate</span>
  <span class="text-xs opacity-80">(CTRL+SHIFT+SPACE)</span>
</Button>
