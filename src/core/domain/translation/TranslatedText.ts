import { ValueObject } from '../shared/ValueObject';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';

export class TranslatedText extends ValueObject {
  private constructor(private readonly translatedValue: string) {
    super();
  }

  public get value(): string {
    return this.translatedValue;
  }

  public static create(value: string): Result<TranslatedText, DomainError> {
    if (!value || value.trim().length === 0) {
      return failure(new DomainError('Translated text cannot be empty'));
    }

    return success(new TranslatedText(value.trim()));
  }
}
