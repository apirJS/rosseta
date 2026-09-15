import type {
  IModelFetchService,
  ModelInfo,
} from '../../src/core/ports/outbound/IModelFetchService';
import { success, failure, type Result } from '../../src/shared/types/Result';
import type { AppError } from '../../src/shared/errors';
import { ValidationError } from '../../src/shared/errors';
import { isCustomProviderId } from '../../src/core/domain/provider/CustomProviderConfig';

export class FakeModelFetchService implements IModelFetchService {
  private fetchable = new Set<string>([
    'google',
    'openai',
    'groq',
    'xai',
    'mistral',
    'deepinfra',
    'anthropic',
    'zai',
    'openrouter',
  ]);
  private responses = new Map<string, ModelInfo[] | AppError>();
  lastCall: { provider: string; apiKey: string; baseURL?: string } | null =
    null;

  canFetch(provider: string): boolean {
    return isCustomProviderId(provider) || this.fetchable.has(provider);
  }

  async fetchModels(
    provider: string,
    apiKey: string,
    baseURL?: string,
  ): Promise<Result<ModelInfo[], AppError>> {
    this.lastCall = { provider, apiKey, baseURL };

    if (!this.canFetch(provider)) {
      return failure(
        ValidationError.invalidInput(
          `Model fetching is not supported for this provider. Add models manually.`,
          { provider },
        ),
      );
    }

    const response = this.responses.get(provider);
    if (response === undefined) {
      return success([]);
    }
    if (response instanceof Error) {
      return failure(response as AppError);
    }
    return success(response);
  }

  seedModels(provider: string, models: ModelInfo[]): void {
    this.responses.set(provider, models);
  }

  seedError(provider: string, error: AppError): void {
    this.responses.set(provider, error);
  }

  setFetchable(providers: string[]): void {
    this.fetchable = new Set(providers);
  }
}
