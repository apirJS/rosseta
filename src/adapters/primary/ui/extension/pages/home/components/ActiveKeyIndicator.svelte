<script lang="ts">
  import { Icon } from '../../../../shared/components';
  import { getAuthStateContext } from '../../../../shared/context';
  import type { Credential } from '../../../../../../../core/domain/credential/Credential';
  import { KeySelectionMode } from '../../../../../../../core/domain/credential/KeySelectionMode';
  import KeySelectorDropdown from './KeySelectorDropdown.svelte';

  interface Props {
    credential: Credential;
    onMenuToggle: () => void;
    isMenuOpen: boolean;
  }

  const { credential, onMenuToggle, isMenuOpen }: Props = $props();
  const auth = getAuthStateContext();

  const allCredentials = $derived(auth.state.credentials?.items ?? []);
  const hasMultiple = $derived(allCredentials.length > 1);
  const showGeminiAutoBalance = $derived(
    allCredentials.filter((c) => c.provider === 'gemini').length >= 2,
  );
  const showGroqAutoBalance = $derived(
    allCredentials.filter((c) => c.provider === 'groq').length >= 2,
  );
  const currentMode = $derived(auth.state.keySelectionMode);

  let isOpen = $state(false);
  let triggerEl = $state<HTMLButtonElement>();
  let popoverEl = $state<HTMLDivElement>();

  function getDisplayLabel(cred: Credential): string {
    const key = cred.apiKey?.value ?? '';
    const providerLabel = cred.provider === 'groq' ? 'Groq' : 'Gemini';
    const masked = key.length > 8 ? `${key.slice(0, 8)}****` : key;
    return `${providerLabel} · ${masked}`;
  }

  function getTriggerLabel(): string {
    if (currentMode.isAutoBalance) {
      const provider = currentMode.autoBalanceProvider;
      return `Auto ⟳ ${provider === 'groq' ? 'GROQ' : 'GEMINI'}`;
    }
    return getDisplayLabel(credential);
  }

  function selectKey(cred: Credential) {
    if (!currentMode.isManual) {
      auth.setKeySelectionMode(KeySelectionMode.manual());
    }
    auth.setActiveKey(cred.id);
    isOpen = false;
  }

  function selectAutoBalance(provider: 'gemini' | 'groq') {
    const mode =
      provider === 'gemini'
        ? KeySelectionMode.autoBalanceGemini()
        : KeySelectionMode.autoBalanceGroq();
    auth.setKeySelectionMode(mode);
    isOpen = false;
  }

  // Close on click outside
  $effect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: PointerEvent) {
      const target = e.target as Node;
      if (
        triggerEl &&
        !triggerEl.contains(target) &&
        popoverEl &&
        !popoverEl.contains(target)
      ) {
        isOpen = false;
      }
    }

    document.addEventListener('pointerdown', handleClickOutside);
    return () =>
      document.removeEventListener('pointerdown', handleClickOutside);
  });
</script>

<div class="flex items-center gap-2">
  <button
    type="button"
    class="p-1 text-muted hover:text-foreground cursor-pointer"
    onclick={onMenuToggle}
    aria-label="Menu"
  >
    <Icon name="menu" class="w-5 h-5" />
  </button>

  {#if hasMultiple}
    <div class="relative">
      <button
        type="button"
        bind:this={triggerEl}
        class="inline-flex items-center gap-1.5 text-sm text-foreground font-medium cursor-pointer
               px-2.5 py-1 rounded-md border border-border
               hover:text-primary hover:border-primary/50 transition-colors max-w-[240px] select-none"
        onclick={() => (isOpen = !isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span class="truncate">{getTriggerLabel()}</span>
        <Icon
          name="chevron-down"
          class="w-3.5 h-3.5 text-muted flex-shrink-0 transition-transform {isOpen
            ? 'rotate-180'
            : ''}"
        />
      </button>

      {#if isOpen}
        <div bind:this={popoverEl}>
          <KeySelectorDropdown
            credentials={allCredentials}
            activeCredentialId={credential.id}
            {currentMode}
            {showGeminiAutoBalance}
            {showGroqAutoBalance}
            onSelectKey={selectKey}
            onSelectAutoBalance={selectAutoBalance}
          />
        </div>
      {/if}
    </div>
  {:else}
    <span class="text-sm text-foreground font-medium truncate max-w-[160px]">
      {getDisplayLabel(credential)}
    </span>
  {/if}
</div>
