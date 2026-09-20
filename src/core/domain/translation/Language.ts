import { ValueObject } from '../shared/ValueObject';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';
import { LANGUAGE_MAP } from './LANGUAGE_MAP';

export type LanguageCode = keyof typeof LANGUAGE_MAP;

export class Language extends ValueObject {
  private constructor(
    private readonly codeValue: LanguageCode,
    private readonly nameValue: string,
  ) {
    super();
  }

  public get code(): LanguageCode {
    return this.codeValue;
  }

  public get name(): string {
    return this.nameValue;
  }

  public static create(code: LanguageCode): Language {
    return new Language(code, LANGUAGE_MAP[code]);
  }

  public static fromRaw(raw: string): Result<Language, DomainError> {
    if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
      return failure(
        new DomainError('Language code must be a non-empty string'),
      );
    }

    const trimmed = raw.trim();

    if (trimmed in LANGUAGE_MAP) {
      return success(Language.create(trimmed as LanguageCode));
    }

    return failure(new DomainError(`Unknown language code: "${trimmed}"`));
  }
}
