<script lang="ts">
  import { Icon } from '../../../../shared/components';
  import { cn } from '../../../../shared/utils';
  import type { TimeFilter } from '../HistoryController.svelte';

  interface Props {
    searchQuery: string;
    timeFilter: TimeFilter;
    onsearch: (value: string) => void;
    onfilter: (value: TimeFilter) => void;
    class?: string;
  }

  const {
    searchQuery,
    timeFilter,
    onsearch,
    onfilter,
    class: className,
  }: Props = $props();

  const timeFilterOptions: { value: TimeFilter; label: string }[] = [
    { value: '24h', label: 'Last 24 hours' },
    { value: '7d', label: 'Last 7 days' },
    { value: 'all', label: 'All time' },
  ];
</script>

<div class={cn('flex gap-2', className)}>
  <div class="relative flex-1">
    <Icon
      name="search"
      class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted"
    />
    <input
      type="text"
      placeholder="Search..."
      class="w-full pl-8 pr-3 py-1.5 text-sm bg-surface border border-border rounded-md text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
      value={searchQuery}
      oninput={(e: Event) => onsearch((e.target as HTMLInputElement).value)}
    />
  </div>
  <select
    class="px-2 py-1.5 text-xs bg-surface border border-border rounded-md text-foreground focus:outline-none focus:border-primary cursor-pointer"
    value={timeFilter}
    onchange={(e: Event) =>
      onfilter((e.target as HTMLSelectElement).value as TimeFilter)}
  >
    {#each timeFilterOptions as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</div>
