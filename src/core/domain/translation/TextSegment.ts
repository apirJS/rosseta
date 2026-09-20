import { ValueObject } from '../shared/ValueObject';
import { failure, success, type Result } from '../../../shared/types/Result';
import { DomainError } from '../shared/DomainError';
import type { Language } from './Language';

export class TextSegment extends ValueObject {
  private constructor(
    private readonly textValue: string,
    private readonly languageValue: Language,
    private readonly blockIndexValue: number,
    private readonly romanizationValue?: string | null,
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
    return this.textValue;
  }

  public get language(): Language {
    return this.languageValue;
  }

  public get blockIndex(): number {
    return this.blockIndexValue;
  }

  public get romanization(): string | null {
    return this.romanizationValue ?? null;
  }
}
