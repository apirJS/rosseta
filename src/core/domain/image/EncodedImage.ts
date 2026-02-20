import { ValueObject } from '../shared/ValueObject';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';

export class EncodedImage extends ValueObject {
  private readonly _value: string;

  private constructor(value: string) {
    super();
    this._value = value;
  }

  public get value(): string {
    return this._value;
  }

  public get mimeType(): string {
    const match = this._value.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,/);
    return match?.[1] ?? 'image/png';
  }

  public get base64Data(): string {
    const commaIndex = this._value.indexOf(',');
    return commaIndex >= 0 ? this._value.slice(commaIndex + 1) : this._value;
  }

  public static create(value: string): Result<EncodedImage, DomainError> {
    if (!value) {
      return failure(new DomainError('Image data cannot be empty'));
    }

    if (!value.startsWith('data:image/')) {
      return failure(
        new DomainError(
          'Invalid image format. Must be a base64 data URL starting with "data:image/"',
        ),
      );
    }

    return success(new EncodedImage(value));
  }
}
