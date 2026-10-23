import type { TranslationDraft } from '../../../../../core/ports/outbound/TranslationExecutionOptions';
import type { TranslationModalPayload } from '../../../../../shared/types/TranslationModalPayload';
import type { SafeTranslationError } from '../../../../../shared/messaging/MessageSchema';
import {
  groupSegmentsIntoBlocks,
  joinSegmentBlocks,
  mapDraftSegments,
  type SegmentPayload,
} from './translation-modal-segments';
import { ModalDragController } from './ModalDragController.svelte';
import {
  TranslationCopyController,
  type CopyTarget,
} from './TranslationCopyController.svelte';

export class TranslationModalController {
  public readonly drag = new ModalDragController();
  public readonly clipboard = new TranslationCopyController();

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
  private revision = $state(0);
  private disposed = false;
  private showStatus = $state(true);
  private statusTimer?: ReturnType<typeof setTimeout>;
  public readonly headerStatus = $derived(
    this.isUnsuccessful || !this.showStatus ? '' : this.status,
  );
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

  public readonly displayedLangLabel = $derived.by(() => {
    if (this.hoveredSegmentIndex !== null && this.isMultiLang) {
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

  public get attemptRevision(): number {
    return this.revision;
  }

  public hoverSegment = (index: number | null) => {
    this.hoveredSegmentIndex = index;
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
      this.setStatus('Preparing...');
    } else {
      this.hideCompletedStatus();
    }
  }

  public started = (language: { code: string; name: string }) => {
    if (this.disposed) return;
    this.targetLanguage = language;
    this.phase = 'generating';
    this.setStatus('Translating...');
  };

  public reset = () => {
    if (this.disposed) return;
    this.revision++;
    this.clearContent();
    this.errorMessage = '';
    this.phase = 'generating';
    this.setStatus(this.revision > 1 ? 'Retrying...' : 'Translating...');
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
    this.setStatus('Finishing...');
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
    this.setStatus('Complete');
    this.errorMessage = '';
    this.resetFeedback();
    this.hideCompletedStatus();
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
    this.setStatus(error.title);
    this.errorMessage = error.userMessage;
  };

  public cancelled = () => {
    if (this.disposed) return;
    this.phase = 'cancelled';
    this.setStatus('Translation cancelled');
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
    this.clipboard.reset();
  }

  public copy = async (target: CopyTarget): Promise<void> => {
    if (!this.canCopy || this.disposed) return;

    const text =
      target === 'original'
        ? this.originalText
        : target === 'translated'
          ? this.translatedText
          : this.description;

    await this.clipboard.copy(target, text);
  };

  private setStatus(status: string): void {
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusTimer = undefined;
    this.status = status;
    this.showStatus = true;
  }

  private hideCompletedStatus(): void {
    this.statusTimer = setTimeout(() => {
      this.showStatus = false;
      this.statusTimer = undefined;
    }, 1_000);
  }

  public dispose = () => {
    this.disposed = true;
    this.drag.dispose();
    this.clipboard.dispose();
    if (this.statusTimer) clearTimeout(this.statusTimer);
  };
  public close = () => {
    if (this.disposed) return;
    this.dispose();
    this.detachModal();
  };
}
