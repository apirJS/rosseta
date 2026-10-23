import type { ICancellationToken } from './ICancellationToken';
import type { ITranslationProgressObserver } from './ITranslationProgressObserver';

/** Provisional display data, never a completed domain translation. */
export interface TranslationDraftSegment {
  index: number;
  blockIndex: number | null;
  originalText: string;
  translatedText: string;
  sourceLanguageCode: string | null;
  romanization: string | null;
}

export interface TranslationDraft {
  segments: readonly TranslationDraftSegment[];
  description: string | null;
}

export type TranslationProgress =
  { kind: 'reset' } | { kind: 'snapshot'; draft: TranslationDraft };

export interface TranslationExecutionOptions {
  cancellationToken?: ICancellationToken;
  generationDeadlineAt?: number;
  progress?: ITranslationProgressObserver;
}
