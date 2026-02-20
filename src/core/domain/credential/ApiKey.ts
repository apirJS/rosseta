import { ValueObject } from '../shared/ValueObject';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';
import { detectProvider, type Provider } from './Provider';

export class ApiKey extends ValueObject {
  private constructor(
    private readonly _value: string,
    private readonly _provider: Provider,
  ) {
    super();
  }

  public static create(value: string): Result<ApiKey, DomainError> {
    if (!value || value.trim().length === 0) {
      return failure(new DomainError('API key cannot be empty'));
    }

    const trimmed = value.trim();
    const provider = detectProvider(trimmed);

    if (!provider) {
      return failure(
        new DomainError(
          'API key must start with "AIza" (Gemini) or "gsk_" (Groq)',
        ),
      );
    }

    return success(new ApiKey(trimmed, provider));
  }

  public get value(): string {
    return this._value;
  }

  public get provider(): Provider {
    return this._provider;
  }
}
