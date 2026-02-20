import type { IApiKeyValidator } from '../../src/core/ports/outbound/IApiKeyValidator';
import type { Provider } from '../../src/core/domain/credential/Provider';
import { success, failure, type Result } from '../../src/shared/types/Result';
import type { AppError } from '../../src/shared/errors';

export class FakeApiKeyValidator implements IApiKeyValidator {
  private _error: AppError | null = null;

  failWith(error: AppError): void {
    this._error = error;
  }

  succeedAlways(): void {
    this._error = null;
  }

  async validate(
    _apiKey: string,
    _provider: Provider,
  ): Promise<Result<void, AppError>> {
    if (this._error) {
      const error = this._error;
      this._error = null;
      return failure(error);
    }
    return success(undefined);
  }
}
