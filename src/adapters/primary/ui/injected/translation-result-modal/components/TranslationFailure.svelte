<script lang="ts">
  interface Props {
    title: string;
    description: string;
    onretry: () => void;
  }

  const { title, description, onretry }: Props = $props();
  let retryButton = $state<HTMLButtonElement>();

  $effect(() => {
    retryButton?.focus({ preventScroll: true });
  });
</script>

<h2 class="translation-error-title">{title}</h2>
<p class="translation-error" role="alert">{description}</p>
<button
  class="translation-retry"
  type="button"
  onclick={onretry}
  bind:this={retryButton}
>
  Select area again
</button>
