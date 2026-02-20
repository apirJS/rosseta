import { ValueObject } from '../shared/ValueObject';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';
import type { Provider } from '../credential/Provider';
import { ProviderRegistry } from '../provider/ProviderRegistry';

/**
 * Value object representing an AI model.
 *
 * This is a pure value object — it does NOT hold defaults or
 * provider-specific logic. Use ProviderRegistry for that.
 */
export class AiModel extends ValueObject {
  private constructor(
    private readonly _id: string,
    private readonly _name: string,
    private readonly _provider: Provider,
  ) {
    super();
  }

  public get id(): string {
    return this._id;
  }

  public get name(): string {
    return this._name;
  }

  public get provider(): Provider {
    return this._provider;
  }

  public static create(id: string): AiModel {
    const entries = ProviderRegistry.getAllModelEntries();
    const entry = entries[id];
    if (!entry) throw new Error(`Unknown model: ${id}`);
    return new AiModel(id, entry.name, entry.provider);
  }

  public static fromRaw(raw: string): Result<AiModel, DomainError> {
    if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
      return failure(new DomainError('Model ID must be a non-empty string'));
    }

    const trimmed = raw.trim();
    const entries = ProviderRegistry.getAllModelEntries();

    if (trimmed in entries) {
      return success(AiModel.create(trimmed));
    }

    return failure(new DomainError(`Unknown model ID: "${trimmed}"`));
  }
}
