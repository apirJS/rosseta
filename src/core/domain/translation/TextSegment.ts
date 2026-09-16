import { ValueObject } from '../shared/ValueObject';
import { failure, success, type Result } from '../../../shared/types/Result';
import { DomainError } from '../shared/DomainError';
import type { Language } from './Language';

export class TextSegment extends ValueObject {
  private constructor(
    private readonly _text: string,
    private readonly _language: Language,
    private readonly _blockIndex: number,
    private readonly _romanization?: string | null,
  ) {
    super();
  }

  public static create(
    text: string,
    language: Language,
    romanization?: string | null,
    blockIndex = 0,
  ): Result<TextSegment, DomainError> {
    if (!text || text.trim().length === 0) {
      return failure(new DomainError('TextSegment text cannot be empty'));
    }

    const normalizedBlockIndex =
      Number.isInteger(blockIndex) && blockIndex >= 0 ? blockIndex : 0;

    return success(
      new TextSegment(
        text.trim(),
        language,
        normalizedBlockIndex,
        romanization?.trim() || null,
      ),
    );
  }

  public get text(): string {
    return this._text;
  }

  public get language(): Language {
    return this._language;
  }

  public get blockIndex(): number {
    return this._blockIndex;
  }

  public get romanization(): string | null {
    return this._romanization ?? null;
  }
}
