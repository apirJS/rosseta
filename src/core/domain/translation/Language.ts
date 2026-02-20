import { ValueObject } from '../shared/ValueObject';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';
import { LANGUAGE_MAP } from './LANGUAGE_MAP';

export type LanguageCode = keyof typeof LANGUAGE_MAP;

export class Language extends ValueObject {
  private constructor(
    private readonly _code: LanguageCode,
    private readonly _name: string,
  ) {
    super();
  }

  public get code(): LanguageCode {
    return this._code;
  }

  public get name(): string {
    return this._name;
  }

  /**
   * Create a Language from a known code (compile-time autocomplete).
   * Use this when you have type-safe input from a dropdown or constant.
   */
  public static create(code: LanguageCode): Language {
    return new Language(code, LANGUAGE_MAP[code]);
  }

  /**
   * Create a Language from raw string input (runtime validation).
   * Use this when reading from storage, API, or user input.
   */
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
