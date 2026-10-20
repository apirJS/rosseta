import type { TranslationDraft } from '../../../../../core/ports/outbound/TranslationExecutionOptions';
import type { TranslationModalPayload } from '../../../../../shared/types/TranslationModalPayload';
import type { SafeTranslationError } from '../../../../../shared/messaging/MessageSchema';

export interface TranslationView {
  started(language: { code: string; name: string }): void;
  reset(): void;
  snapshot(draft: TranslationDraft): void;
  committing(): void;
  completed(translation: TranslationModalPayload, historySaved: boolean): void;
  failed(error: SafeTranslationError): void;
  cancelled(): void;
  dispose(): void;
}
