import { ValueObject } from '../shared/ValueObject';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';
import type { AnyProvider } from './Provider';

export class ApiKey extends ValueObject {
  private constructor(
    private readonly _value: string,
    private readonly _provider: AnyProvider,
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
    return this._value;
  }

  public get provider(): AnyProvider {
    return this._provider;
  }
}
