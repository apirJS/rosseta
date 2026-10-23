import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';
import type { TranslationProgress } from './TranslationExecutionOptions';

export interface ITranslationProgressObserver {
  report(progress: TranslationProgress): Promise<Result<void, AppError>>;
}
