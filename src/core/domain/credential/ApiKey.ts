import { ValueObject } from '../shared/ValueObject';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';
import type { AnyProvider } from './Provider';

export class ApiKey extends ValueObject {
  private constructor(
    private readonly apiKeyValue: string,
    private readonly providerValue: AnyProvider,
  ) {
    super();
  }

  public static createWithProvider(
    value: string,
    provider: AnyProvider,
  ): Result<ApiKey, DomainError> {
    if (!value || value.trim().length === 0) {
      return failure(new DomainError('API key cannot be empty'));
    }

    return success(new ApiKey(value.trim(), provider));
  }

  public static fromRaw(
    value: string,
    provider: AnyProvider,
  ): Result<ApiKey, DomainError> {
    return ApiKey.createWithProvider(value, provider);
  }

  public get value(): string {
    return this.apiKeyValue;
  }

  public get provider(): AnyProvider {
    return this.providerValue;
  }
}
