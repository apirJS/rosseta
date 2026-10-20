import type { TranslationDraft } from '../../../../../core/ports/outbound/TranslationExecutionOptions';
import type { TranslationModalPayload } from '../../../../../shared/types/TranslationModalPayload';
import type { SafeTranslationError } from '../../../../../shared/messaging/MessageSchema';
import {
  groupSegmentsIntoBlocks,
  joinSegmentBlocks,
  mapDraftSegments,
  type SegmentPayload,
} from './translation-modal-segments';
import { writeToClipboard } from './write-to-clipboard';

type CopyState = 'idle' | 'copied';

type CopyTarget = 'original' | 'translated' | 'description';

const COPY_FEEDBACK_DURATION_MS = 2_000;

export class TranslationModalController {
  public posX = $state(0);
  public posY = $state(0);
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  public originalCopy = $state<CopyState>('idle');
  public translatedCopy = $state<CopyState>('idle');
  public descriptionCopy = $state<CopyState>('idle');
  private readonly copyTimers = new Map<
    CopyTarget,
    ReturnType<typeof setTimeout>
  >();

  public original = $state<SegmentPayload[]>([]);
  public translated = $state<SegmentPayload[]>([]);
  public description = $state('');
  public phase = $state<
    | 'preparing'
    | 'generating'
    | 'committing'
    | 'completed'
    | 'failed'
    | 'cancelled'
  >('completed');
  public status = $state('Complete');
  public errorMessage = $state('');
  public historySaved = $state(true);
  public readonly canCopy = $derived(this.phase === 'completed');
  public readonly isUnsuccessful = $derived(
    this.phase === 'failed' || this.phase === 'cancelled',
  );
  public readonly failureDescription = $derived(
    this.errorMessage || 'Select an area to start a new translation.',
  );
  public readonly isBusy = $derived(
    this.phase === 'preparing' ||
      this.phase === 'generating' ||
      this.phase === 'committing',
  );
  private targetLanguage = $state<{ code: string; name: string }>({
    code: 'unknown',
    name: '',
  });
  private revision = 0;
  private disposed = false;
  private dragCleanup: (() => void) | undefined;
  private readonly onretry?: () => void;
  private readonly detachModal: () => void;

  public readonly originalBlocks = $derived.by(() =>
    groupSegmentsIntoBlocks(this.original),
  );

  public readonly translatedBlocks = $derived.by(() =>
    groupSegmentsIntoBlocks(this.translated),
  );

  public readonly originalText = $derived.by(() =>
    joinSegmentBlocks(this.originalBlocks),
  );

  public readonly translatedText = $derived.by(() =>
    joinSegmentBlocks(this.translatedBlocks),
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

  private hoveredSegmentIndex = $state<number | null>(null);
  private hoveredSide = $state<'original' | 'translated' | null>(null);

  public readonly displayedLangLabel = $derived.by(() => {
    if (this.hoveredSide === 'original' && this.isMultiLang) {
      const segment = this.original.find(
        (value, index) => (value.index ?? index) === this.hoveredSegmentIndex,
      );

      if (
        segment &&
        !TranslationModalController.NON_LANG_CODES.has(segment.language.code)
      ) {
        return `${segment.language.name} (${segment.language.code})`;
      }
    }

    return this.detectedLanguageLabel;
  });

  public readonly highlightedSegmentIndex = $derived(this.hoveredSegmentIndex);

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
    live?: boolean;
    onretry?: () => void;
  }) {
    this.original = props.original;
    this.translated = props.translated;
    this.description = props.description;
    this.detachModal = props.detachModal;
    this.onretry = props.onretry;

    if (props.live) {
      this.phase = 'preparing';
      this.status = 'Preparing...';
    }
  }

  public started = (language: { code: string; name: string }) => {
    if (this.disposed) return;
    this.targetLanguage = language;
    this.phase = 'generating';
    this.status = 'Translating...';
  };

  public reset = () => {
    if (this.disposed) return;
    this.revision++;
    this.clearContent();
    this.errorMessage = '';
    this.phase = 'generating';
    this.status = this.revision > 1 ? 'Retrying...' : 'Translating...';
    this.resetFeedback();
  };

  public snapshot = (draft: TranslationDraft) => {
    if (this.disposed || this.phase !== 'generating') return;

    const segments = mapDraftSegments(
      draft,
      this.targetLanguage,
      this.revision,
    );

    this.original = segments.original;
    this.translated = segments.translated;
    this.description = draft.description ?? '';
  };

  public committing = () => {
    if (this.disposed) return;
    this.phase = 'committing';
    this.status = 'Finishing...';
  };

  public completed = (
    translation: TranslationModalPayload,
    historySaved: boolean,
  ) => {
    if (this.disposed) return;
    this.original = translation.original;
    this.translated = translation.translated;
    this.description = translation.description;
    this.historySaved = historySaved;
    this.phase = 'completed';
    this.status = 'Complete';
    this.errorMessage = '';
    this.resetFeedback();
  };

  public failed = (error: SafeTranslationError) => {
    if (this.disposed) return;

    if (
      error.code === 'TRANSLATION_NO_TEXT_FOUND' ||
      error.code === 'TRANSLATION_CONTENT_BLOCKED' ||
      error.code === 'TRANSLATION_AI_REJECTED'
    ) {
      this.clearContent();
    }

    this.phase = 'failed';
    this.status = error.title;
    this.errorMessage = error.userMessage;
  };

  public cancelled = () => {
    if (this.disposed) return;
    this.phase = 'cancelled';
    this.status = 'Translation cancelled';
  };

  public retry = () => {
    if (!this.disposed) this.onretry?.();
  };

  private clearContent(): void {
    this.original = [];
    this.translated = [];
    this.description = '';
  }

  private resetFeedback(): void {
    this.hoveredSegmentIndex = null;
    this.hoveredSide = null;
    this.originalCopy = 'idle';
    this.translatedCopy = 'idle';
    this.descriptionCopy = 'idle';
  }

  public handleDragStart = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.dragCleanup?.();
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
      this.dragCleanup = undefined;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    this.dragCleanup = onUp;
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
    target: CopyTarget,
  ): Promise<void> {
    if (!this.canCopy || this.disposed) return;

    const copied = await writeToClipboard(text);

    if (copied && !this.disposed) this.showCopyFeedback(target);
  }

  private showCopyFeedback(target: CopyTarget): void {
    this.setCopyState(target, 'copied');

    const existingTimer = this.copyTimers.get(target);

    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      this.setCopyState(target, 'idle');
      this.copyTimers.delete(target);
    }, COPY_FEEDBACK_DURATION_MS);

    this.copyTimers.set(target, timer);
  }

  private setCopyState(target: CopyTarget, state: CopyState): void {
    if (target === 'original') this.originalCopy = state;
    else if (target === 'translated') this.translatedCopy = state;
    else this.descriptionCopy = state;
  }

  public dispose = () => {
    this.disposed = true;
    this.dragCleanup?.();
    for (const timer of this.copyTimers.values()) clearTimeout(timer);
    this.copyTimers.clear();
  };
  public close = () => {
    if (this.disposed) return;
    this.dispose();
    this.detachModal();
  };
}
