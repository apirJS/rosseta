import { ValueObject } from '../shared/ValueObject';
import { failure, success, type Result } from '../../../shared/types/Result';
import { DomainError } from '../shared/DomainError';
import type { Language } from './Language';

export class TextSegment extends ValueObject {
  private constructor(
    private readonly _text: string,
    private readonly _language: Language,
    private readonly _romanization?: string | null,
  ) {
    super();
  }

  public static create(
    text: string,
    language: Language,
    romanization?: string | null,
  ): Result<TextSegment, DomainError> {
    if (!text || text.trim().length === 0) {
      return failure(new DomainError('TextSegment text cannot be empty'));
    }

    return success(
      new TextSegment(text.trim(), language, romanization?.trim() || null),
    );
  }

  public get text(): string {
    return this._text;
  }

  public get language(): Language {
    return this._language;
  }

  public get romanization(): string | null {
    return this._romanization ?? null;
  }
}
