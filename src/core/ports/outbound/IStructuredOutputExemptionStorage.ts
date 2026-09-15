import type { AppError } from '../../../shared/errors';
import type { Result } from '../../../shared/types/Result';

export interface IStructuredOutputExemptionStorage {
  isExempt(modelKey: string): Promise<Result<boolean, AppError>>;
  exemptModel(modelKey: string): Promise<Result<void, AppError>>;
}
