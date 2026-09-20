import type { IStructuredOutputExemptionStorage } from '../../src/core/ports/outbound/IStructuredOutputExemptionStorage';
import { AppError } from '../../src/shared/errors';
import { failure, type Result, success } from '../../src/shared/types/Result';

export class FakeStructuredOutputExemptionStorage
  implements IStructuredOutputExemptionStorage
{
  private readonly exempted = new Set<string>();
  private injectedError: AppError | null = null;

  readonly isExemptCalls: string[] = [];
  readonly exemptCalls: string[] = [];

  failNextCallWith(error: AppError): void {
    this.injectedError = error;
  }

  seedExempt(modelKey: string): void {
    this.exempted.add(modelKey);
  }

  isExempted(modelKey: string): boolean {
    return this.exempted.has(modelKey);
  }

  private consumeError(): AppError | null {
    const error = this.injectedError;
    this.injectedError = null;
    return error;
  }

  async isExempt(modelKey: string): Promise<Result<boolean, AppError>> {
    this.isExemptCalls.push(modelKey);
    const error = this.consumeError();
    if (error) return failure(error);
    return success(this.exempted.has(modelKey));
  }

  async exemptModel(modelKey: string): Promise<Result<void, AppError>> {
    this.exemptCalls.push(modelKey);
    const error = this.consumeError();
    if (error) return failure(error);
    this.exempted.add(modelKey);
    return success(undefined);
  }
}
