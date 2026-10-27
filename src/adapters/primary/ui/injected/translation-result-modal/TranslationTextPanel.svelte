<script lang="ts">
  import type { IndexedSegmentPayload } from './translation-modal-segments';
  import type { CopyState } from './TranslationCopyController.svelte';
  import ModalSection from './components/ModalSection.svelte';
  import TextSection from './components/TextSection.svelte';

  interface Props {
    label: 'Original' | 'Translated';
    languageLabel: string;
    copyLabel: string;
    blocks: IndexedSegmentPayload[][];
    copyState: CopyState;
    oncopy: () => void;
    canCopy: boolean;
    langColorMap: Map<string, number>;
    isMultiLang?: boolean;
    hasRomanization: boolean;
    highlightIndex: number | null;
    onhover: (index: number | null) => void;
    pending: boolean;
  }

  const {
    label,
    languageLabel,
    copyLabel,
    blocks,
    copyState,
    oncopy,
    canCopy,
    langColorMap,
    isMultiLang = false,
    hasRomanization,
    highlightIndex,
    onhover,
    pending,
  }: Props = $props();
</script>

<ModalSection
  {label}
  labelTag={languageLabel}
  {copyState}
  {oncopy}
  {copyLabel}
  disabled={!canCopy}
>
  <TextSection
    {blocks}
    {langColorMap}
    {isMultiLang}
    {hasRomanization}
    {highlightIndex}
    onSegmentIndexHover={onhover}
    {pending}
  />
</ModalSection>
