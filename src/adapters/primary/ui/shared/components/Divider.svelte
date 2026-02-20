<script lang="ts">
  interface Props {
    label?: string;
  }

  const { label }: Props = $props();
</script>

<div class="relative">
  <div class="absolute inset-0 flex items-center">
    <span class="w-full border-t border-border"></span>
  </div>
  {#if label}
    <div class="relative flex justify-center text-xs uppercase">
      <span class="bg-background px-2 text-muted">{label}</span>
    </div>
  {/if}
</div>
