<script lang="ts">
  interface Props {
    title: string;
    status?: string;
    busy?: boolean;
    onclose: () => void;
    ondragstart: (e: PointerEvent) => void;
  }

  const {
    title,
    status = '',
    busy = false,
    onclose,
    ondragstart,
  }: Props = $props();

  const statusLabel = $derived(
    busy ? status.replace(/(?:\.{3}|…)$/, '') : status,
  );

  let showStatus = $state<boolean>(true);

  $effect(() => {
    if (status.toLocaleLowerCase() === 'complete') {
      const timer = setTimeout(() => {
        showStatus = false;
      }, 1_000);

      return () => clearTimeout(timer);
    } else {
      showStatus = true;
    }
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-header flex items-end gap-x-1" onpointerdown={ondragstart}>
  <span class="modal-header-title">{title}</span>
  {#if status && showStatus}
    <span
      class={`translation-status`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span>{statusLabel}</span>
      {#if busy}
        <span class="translation-status-dots" aria-hidden="true"
          ><span>...</span></span
        >
      {/if}
    </span>
  {/if}

  <button
    class="modal-close-btn"
    onclick={onclose}
    aria-label="Close"
    title="Close (Esc)"
  >
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  </button>
</div>
