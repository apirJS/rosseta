<script lang="ts">
  interface Props {
    message: string;
  }

  const { message }: Props = $props();
</script>

<p class="text-sm text-muted text-center py-8">
  {message}
</p>
