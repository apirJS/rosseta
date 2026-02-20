<script lang="ts">
  interface Props {
    message?: string | null;
    truncate?: boolean;
  }

  const { message = null, truncate = false }: Props = $props();
</script>

{#if message}
  <p
    class="text-red-500 text-xs text-center {truncate ? 'truncate' : ''}"
    title={truncate ? message : undefined}
  >
    {message}
  </p>
{/if}
