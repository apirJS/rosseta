<script lang="ts">
  interface Props {
    title: string;
    subtitle?: string;
  }

  const { title, subtitle }: Props = $props();
</script>

<header class="text-center">
  <h1 class="text-xl font-semibold text-foreground">{title}</h1>
  {#if subtitle}
    <p class="text-sm text-muted mt-1">{subtitle}</p>
  {/if}
</header>
