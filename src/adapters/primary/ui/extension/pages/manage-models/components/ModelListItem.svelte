<script lang="ts">
  import { Icon } from '../../../../shared/components';
  import type { StoredModel } from '../../../../../../../core/ports/outbound/IModelStorage';

  interface Props {
    model: StoredModel;
    selected: boolean;
    onselect: () => void;
    onremove: () => void;
  }

  const { model, selected, onselect, onremove }: Props = $props();
</script>

<div
  class="group flex items-center rounded-lg border transition-colors {selected
    ? 'border-primary/50 bg-surface'
    : 'border-border bg-surface'}"
>
  <button
    type="button"
    class="flex-1 flex items-center gap-2 min-w-0 px-3 py-2 text-left cursor-pointer"
    onclick={onselect}
    title="Use this model"
  >
    <span class="text-sm text-foreground truncate" title={model.id}>
      {model.name !== model.id ? model.name : model.id}
    </span>
    {#if selected}
      <Icon name="check" class="w-4 h-4 text-primary shrink-0" />
    {/if}
  </button>
  <button
    type="button"
    class="text-muted hover:text-destructive cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2 mr-2"
    onclick={onremove}
    title="Remove model"
  >
    <Icon name="trash" class="w-4 h-4" />
  </button>
</div>
