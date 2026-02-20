<script lang="ts">
  import { Icon } from '../../../../shared/components';
  import type { Credential } from '../../../../../../../core/domain/credential/Credential';
  import type { KeySelectionMode } from '../../../../../../../core/domain/credential/KeySelectionMode';

  interface Props {
    credentials: readonly Credential[];
    activeCredentialId: string;
    currentMode: KeySelectionMode;
    showGeminiAutoBalance: boolean;
    showGroqAutoBalance: boolean;
    onSelectKey: (credential: Credential) => void;
    onSelectAutoBalance: (provider: 'gemini' | 'groq') => void;
  }

  const {
    credentials,
    activeCredentialId,
    currentMode,
    showGeminiAutoBalance,
    showGroqAutoBalance,
    onSelectKey,
    onSelectAutoBalance,
  }: Props = $props();
</script>

<div
  class="absolute top-full left-0 mt-1.5 min-w-[240px] py-1
         bg-background border border-border rounded-lg shadow-lg z-50
         max-h-[180px] overflow-y-auto"
  role="listbox"
  aria-label="Select API Key"
>
  <!-- Auto-balance options (top) -->
  {#if showGeminiAutoBalance || showGroqAutoBalance}
    {#if showGeminiAutoBalance}
      {@const isAutoGemini = currentMode.value === 'auto-balance:gemini'}
      <button
        type="button"
        role="option"
        aria-selected={isAutoGemini}
        class="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs cursor-pointer
               transition-colors select-none rounded-md
               border {isAutoGemini
          ? 'text-foreground border-primary/40 bg-surface'
          : 'text-muted border-border hover:text-foreground hover:border-primary/30 hover:bg-surface'}"
        style="width: calc(100% - 12px); margin: 2px 6px;"
        onclick={() => onSelectAutoBalance('gemini')}
      >
        <span class="truncate text-xs font-medium">Auto balance ⟳</span>
        <span class="flex items-center gap-2 flex-shrink-0">
          <span
            class="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded border border-blue-400/40 text-blue-400"
            >GEMINI</span
          >
          {#if isAutoGemini}
            <Icon name="check" class="w-4 h-4 text-primary" />
          {:else}
            <span class="w-4"></span>
          {/if}
        </span>
      </button>
    {/if}

    {#if showGroqAutoBalance}
      {@const isAutoGroq = currentMode.value === 'auto-balance:groq'}
      <button
        type="button"
        role="option"
        aria-selected={isAutoGroq}
        class="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs cursor-pointer
               transition-colors select-none rounded-md
               border {isAutoGroq
          ? 'text-foreground border-primary/40 bg-surface'
          : 'text-muted border-border hover:text-foreground hover:border-primary/30 hover:bg-surface'}"
        style="width: calc(100% - 12px); margin: 2px 6px;"
        onclick={() => onSelectAutoBalance('groq')}
      >
        <span class="truncate text-xs font-medium">Auto balance ⟳</span>
        <span class="flex items-center gap-2 flex-shrink-0">
          <span
            class="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded border border-purple-400/40 text-purple-400"
            >GROQ</span
          >
          {#if isAutoGroq}
            <Icon name="check" class="w-4 h-4 text-primary" />
          {:else}
            <span class="w-4"></span>
          {/if}
        </span>
      </button>
    {/if}

    <div class="border-t border-border mx-2 my-1"></div>
  {/if}

  {#each credentials as cred (cred.id)}
    {@const isActive = currentMode.isManual && cred.id === activeCredentialId}
    {@const maskedKey =
      cred.apiKey?.value?.length > 8
        ? `${cred.apiKey.value.slice(0, 8)}****`
        : (cred.apiKey?.value ?? '')}
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      class="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs cursor-pointer
             transition-colors select-none rounded-md mx-auto
             border {isActive
        ? 'text-foreground border-primary/40 bg-surface'
        : 'text-muted border-border hover:text-foreground hover:border-primary/30 hover:bg-surface'}"
      style="width: calc(100% - 12px); margin: 2px 6px;"
      onclick={() => onSelectKey(cred)}
    >
      <!-- Left: masked key -->
      <span class="truncate font-mono text-xs">{maskedKey}</span>

      <!-- Right: provider badge + check -->
      <span class="flex items-center gap-2 flex-shrink-0">
        <span
          class="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded border
                 {cred.provider === 'groq'
            ? 'border-purple-400/40 text-purple-400'
            : 'border-blue-400/40 text-blue-400'}"
        >
          {cred.provider === 'groq' ? 'GROQ' : 'GEMINI'}
        </span>

        {#if isActive}
          <Icon name="check" class="w-4 h-4 text-primary" />
        {:else}
          <span class="w-4"></span>
        {/if}
      </span>
    </button>
  {/each}
</div>
