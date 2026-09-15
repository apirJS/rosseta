type CopyState = 'idle' | 'copied';

export interface SegmentPayload {
  language: { code: string; name: string };
  text: string;
  romanization: string | null;
}

export class TranslationModalController {
  public posX = $state(0);
  public posY = $state(0);
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  public originalCopy = $state<CopyState>('idle');
  public translatedCopy = $state<CopyState>('idle');
  public descriptionCopy = $state<CopyState>('idle');
  private copyTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  public readonly original: SegmentPayload[];
  public readonly translated: SegmentPayload[];
  public readonly description: string;
  private readonly detachModal: () => void;

  public readonly originalText = $derived.by(() =>
    this.original.map((s) => s.text).join(' '),
  );

  public readonly translatedText = $derived.by(() =>
    this.translated.map((s) => s.text).join(' '),
  );

  public readonly originalHasRomanization = $derived.by(() =>
    this.original.some((s) => s.romanization != null),
  );

  public readonly translatedHasRomanization = $derived.by(() =>
    this.translated.some((s) => s.romanization != null),
  );

  public readonly langColorMap = $derived.by(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const seg of this.original) {
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
      (c) => !TranslationModalController.NON_LANG_CODES.has(c),
    );
  });

  public readonly isMultiLang = $derived.by(
    () => this.realLangCodes.length > 1,
  );

  public readonly detectedLanguageLabel = $derived.by(() => {
    if (this.realLangCodes.length > 1) return 'Mixed';
    const first = this.original.find(
      (s) => !TranslationModalController.NON_LANG_CODES.has(s.language.code),
    );
    if (!first) return '';
    return `${first.language.name} (${first.language.code})`;
  });

  public readonly targetLanguageLabel = $derived.by(() => {
    const first = this.translated[0];
    if (!first) return '';
    return `${first.language.name} (${first.language.code})`;
  });

  private hoveredLangLabel = $state<string | null>(null);
  private hoveredSegmentIndex = $state<number | null>(null);
  private hoveredSide = $state<'original' | 'translated' | null>(null);

  public readonly displayedLangLabel = $derived(
    this.hoveredLangLabel ?? this.detectedLanguageLabel,
  );

  public readonly originalCrossHighlight = $derived(
    this.hoveredSide === 'translated' ? this.hoveredSegmentIndex : null,
  );

  public readonly translatedCrossHighlight = $derived(
    this.hoveredSide === 'original' ? this.hoveredSegmentIndex : null,
  );

  public setHoveredLanguageLabel = (label: string | null) => {
    this.hoveredLangLabel = label;
  };

  public hoverOriginalSegment = (index: number | null) => {
    this.hoveredSegmentIndex = index;
    this.hoveredSide = index != null ? 'original' : null;
  };

  public hoverTranslatedSegment = (index: number | null) => {
    this.hoveredSegmentIndex = index;
    this.hoveredSide = index != null ? 'translated' : null;
  };

  constructor(props: {
    original: SegmentPayload[];
    translated: SegmentPayload[];
    description: string;
    detachModal: () => void;
  }) {
    this.original = props.original;
    this.translated = props.translated;
    this.description = props.description;
    this.detachModal = props.detachModal;
  }

  public handleDragStart = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.isDragging = true;
    this.dragStartX = e.clientX - this.posX;
    this.dragStartY = e.clientY - this.posY;

    const onMove = (ev: PointerEvent) => {
      if (!this.isDragging) return;
      this.posX = ev.clientX - this.dragStartX;
      this.posY = ev.clientY - this.dragStartY;
    };

    const onUp = () => {
      this.isDragging = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  public copyOriginal = async () => {
    await this.copyToClipboard(this.originalText, 'original');
  };

  public copyTranslated = async () => {
    await this.copyToClipboard(this.translatedText, 'translated');
  };

  public copyDescription = async () => {
    await this.copyToClipboard(this.description, 'description');
  };

  private async copyToClipboard(
    text: string,
    target: 'original' | 'translated' | 'description',
  ): Promise<void> {
    let success = false;
    try {
      await navigator.clipboard.writeText(text);
      success = true;
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        success = false;
      }
    }

    if (!success) return;

    if (target === 'original') this.originalCopy = 'copied';
    else if (target === 'translated') this.translatedCopy = 'copied';
    else this.descriptionCopy = 'copied';

    const existingTimer = this.copyTimers.get(target);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      if (target === 'original') this.originalCopy = 'idle';
      else if (target === 'translated') this.translatedCopy = 'idle';
      else this.descriptionCopy = 'idle';
      this.copyTimers.delete(target);
    }, 2000);
    this.copyTimers.set(target, timer);
  }

  public handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
  };

  public close = () => {
    for (const timer of this.copyTimers.values()) clearTimeout(timer);
    this.copyTimers.clear();
    this.detachModal();
  };
}
