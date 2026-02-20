<script lang="ts">
  import { Icon } from '../../../../shared/components';
  import type { Credential } from '../../../../../../../core/domain/credential/Credential';

  interface Props {
    credential: Credential;
    isActive: boolean;
    onSetActive: () => void;
    onDelete: () => void;
    onView: () => void;
  }

  const { credential, isActive, onSetActive, onDelete, onView }: Props =
    $props();

  const maskedKey = $derived(
    credential.apiKey.value.length > 10
      ? `${credential.apiKey.value.slice(0, 10)}****`
      : credential.apiKey.value,
  );

  const providerLabel = $derived(
    credential.provider === 'groq' ? 'GROQ' : 'GEMINI',
  );
</script>

<div
  class="flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors {isActive
    ? 'bg-surface border-primary/50'
    : 'bg-surface border-border'}"
>
  <!-- Provider badge -->
  <span
    class="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded {credential.provider ===
    'groq'
      ? 'bg-purple-500/20 text-purple-400'
      : 'bg-blue-500/20 text-blue-400'}"
  >
    {providerLabel}
  </span>

  <!-- Masked key -->
  <button
    type="button"
    class="flex-1 text-sm text-foreground truncate text-left cursor-pointer hover:text-primary transition-colors"
    onclick={onSetActive}
    title="Set as active key"
  >
    {maskedKey}
  </button>

  <!-- Active indicator -->
  {#if isActive}
    <span class="text-[10px] text-primary font-medium">ACTIVE</span>
  {/if}

  <!-- View full key button -->
  <button
    type="button"
    class="p-1 text-muted hover:text-foreground transition-colors cursor-pointer"
    aria-label="View full API key"
    onclick={onView}
  >
    <Icon name="eye" class="w-4 h-4" />
  </button>

  <!-- Delete button -->
  <button
    type="button"
    class="p-1 text-muted hover:text-destructive transition-colors cursor-pointer"
    aria-label="Delete API key"
    onclick={onDelete}
  >
    <Icon name="trash" class="w-4 h-4" />
  </button>
</div>
