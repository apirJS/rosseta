type CopyState = 'idle' | 'copied';

export interface SegmentPayload {
  language: { code: string; name: string };
  text: string;
  romanization: string | null;
}

export class TranslationModalController {
  // --- Drag state ---
  public posX = $state(0);
  public posY = $state(0);
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  // --- Copy state ---
  public originalCopy = $state<CopyState>('idle');
  public translatedCopy = $state<CopyState>('idle');
  public descriptionCopy = $state<CopyState>('idle');
  private copyTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // --- Props ---
  public readonly original: SegmentPayload[];
  public readonly translated: SegmentPayload[];
  public readonly description: string;
  private readonly detachModal: () => void;

  // --- Derived ---
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

  /** Map language codes to consistent color indices */
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

  /** Codes that are not real languages (numbers, symbols, unknown) */
  private static readonly NON_LANG_CODES = new Set([
    'number',
    'symbol',
    'unknown',
  ]);

  /** Real language codes only (excludes number/symbol/unknown) */
  private readonly realLangCodes = $derived.by(() => {
    return [...this.langColorMap.keys()].filter(
      (c) => !TranslationModalController.NON_LANG_CODES.has(c),
    );
  });

  /** Whether multiple source languages are detected */
  public readonly isMultiLang = $derived.by(
    () => this.realLangCodes.length > 1,
  );

  /** Label for detected language(s): "Mixed" or "English (en)" */
  public readonly detectedLanguageLabel = $derived.by(() => {
    if (this.realLangCodes.length > 1) return 'Mixed';
    // Find the first segment with a real language
    const first = this.original.find(
      (s) => !TranslationModalController.NON_LANG_CODES.has(s.language.code),
    );
    if (!first) return '';
    return `${first.language.name} (${first.language.code})`;
  });

  /** Label for target language: "Indonesian (id)" */
  public readonly targetLanguageLabel = $derived.by(() => {
    const first = this.translated[0];
    if (!first) return '';
    return `${first.language.name} (${first.language.code})`;
  });

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

  // ==================== DRAG ====================

  public handleDragStart = (e: PointerEvent) => {
    // Only drag on primary button and direct target (the header itself)
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

  // ==================== COPY ====================

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
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    // Set copied state
    if (target === 'original') this.originalCopy = 'copied';
    else if (target === 'translated') this.translatedCopy = 'copied';
    else this.descriptionCopy = 'copied';

    // Clear previous timer if exists
    const existingTimer = this.copyTimers.get(target);
    if (existingTimer) clearTimeout(existingTimer);

    // Reset after 2 seconds
    const timer = setTimeout(() => {
      if (target === 'original') this.originalCopy = 'idle';
      else if (target === 'translated') this.translatedCopy = 'idle';
      else this.descriptionCopy = 'idle';
      this.copyTimers.delete(target);
    }, 2000);
    this.copyTimers.set(target, timer);
  }

  // ==================== CLOSE ====================

  public handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
  };

  public close = () => {
    for (const timer of this.copyTimers.values()) clearTimeout(timer);
    this.copyTimers.clear();
    this.detachModal();
  };
}
