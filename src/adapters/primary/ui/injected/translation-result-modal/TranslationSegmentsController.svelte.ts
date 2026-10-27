import {
  groupSegmentsIntoBlocks,
  joinSegmentBlocks,
  type SegmentPayload,
} from './translation-modal-segments';

export class TranslationSegmentsController {
  public readonly originalBlocks = $derived.by(() =>
    groupSegmentsIntoBlocks(this.content().original),
  );

  public readonly translatedBlocks = $derived.by(() =>
    groupSegmentsIntoBlocks(this.content().translated),
  );

  public readonly originalText = $derived.by(() =>
    joinSegmentBlocks(this.originalBlocks),
  );

  public readonly translatedText = $derived.by(() =>
    joinSegmentBlocks(this.translatedBlocks),
  );

  public readonly originalHasRomanization = $derived.by(() =>
    this.content().original.some((s) => s.romanization != null),
  );

  public readonly translatedHasRomanization = $derived.by(() =>
    this.content().translated.some((s) => s.romanization != null),
  );

  public readonly langColorMap = $derived.by(() => {
    const map = new Map<string, number>();
    let idx = 0;

    for (const seg of this.content().original) {
      if (!map.has(seg.language.code)) {
        map.set(seg.language.code, idx++ % 8);
      }
    }

    return map;
  });

  private static readonly NON_LANG_CODES = new Set([
    'number',
    'symbol',
    'unknown',
  ]);

  private readonly realLangCodes = $derived.by(() => {
    return [...this.langColorMap.keys()].filter(
      (c) => !TranslationSegmentsController.NON_LANG_CODES.has(c),
    );
  });

  public readonly isMultiLang = $derived.by(
    () => this.realLangCodes.length > 1,
  );

  public readonly detectedLanguageLabel = $derived.by(() => {
    if (this.realLangCodes.length > 1) return 'Mixed';

    const first = this.content().original.find(
      (s) => !TranslationSegmentsController.NON_LANG_CODES.has(s.language.code),
    );

    if (!first) return '';

    return `${first.language.name} (${first.language.code})`;
  });

  public readonly targetLanguageLabel = $derived.by(() => {
    const first = this.content().translated[0];

    if (!first) return '';

    return `${first.language.name} (${first.language.code})`;
  });

  private hoveredSegmentIndex = $state<number | null>(null);

  public readonly displayedLangLabel = $derived.by(() => {
    if (this.hoveredSegmentIndex !== null && this.isMultiLang) {
      const segment = this.content().original.find(
        (value, index) => (value.index ?? index) === this.hoveredSegmentIndex,
      );

      if (
        segment &&
        !TranslationSegmentsController.NON_LANG_CODES.has(segment.language.code)
      ) {
        return `${segment.language.name} (${segment.language.code})`;
      }
    }

    return this.detectedLanguageLabel;
  });

  public readonly highlightedSegmentIndex = $derived(this.hoveredSegmentIndex);

  public hoverSegment = (index: number | null) => {
    this.hoveredSegmentIndex = index;
  };

  constructor(
    private readonly content: () => {
      original: SegmentPayload[];
      translated: SegmentPayload[];
    },
  ) {}
}
