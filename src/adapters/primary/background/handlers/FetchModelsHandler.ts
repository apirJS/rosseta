import type { Container } from '../../../../shared/di/container-factory';
import { isProvider } from '../../../../core/domain/credential/Provider';
import { isCustomProviderId } from '../../../../core/domain/provider/CustomProviderConfig';
import type { Credentials } from '../../../../core/domain/credential/Credentials';
import { AuthError, ValidationError, type AppError } from '../../../../shared/errors';
import type { FetchModelsResponse } from '../../../../shared/validation/MessageSchema';

export class FetchModelsHandler {
  constructor(private readonly container: Container) {}

  async handle(payload: { provider: string }): Promise<FetchModelsResponse> {
    const provider = payload.provider;

    if (isCustomProviderId(provider)) {
      return this.fetchForCustomProvider(provider);
    }

    if (!isProvider(provider)) {
      return this.toErrorResponse(
        ValidationError.invalidInput(`Unknown provider: ${provider}`),
      );
    }

    const apiKey = await this.resolveApiKey(provider);
    if (typeof apiKey !== 'string') {
      return apiKey;
    }

    const result = await this.container.fetchModelsUseCase.execute(
      provider,
      apiKey,
    );
    if (!result.success) {
      return this.toErrorResponse(result.error);
    }

    return { success: true, models: result.data };
  }

  private async fetchForCustomProvider(
    provider: string,
  ): Promise<FetchModelsResponse> {
    const providersResult =
      await this.container.getCustomProvidersUseCase.execute();
    if (!providersResult.success) {
      return this.toErrorResponse(providersResult.error);
    }

    const config = providersResult.data.find(
      (candidate) => candidate.id === provider,
    );
    if (!config) {
      return this.toErrorResponse(
        ValidationError.invalidInput(`Unknown provider: ${provider}`),
      );
    }

    const apiKey = await this.resolveApiKey(provider);
    if (typeof apiKey !== 'string') {
      return apiKey;
    }

    const result = await this.container.fetchModelsUseCase.execute(
      provider,
      apiKey,
      config.baseURL,
      config.headers,
      config.queryParams,
    );
    if (!result.success) {
      return this.toErrorResponse(result.error);
    }

    return { success: true, models: result.data };
  }

  private async resolveApiKey(
    provider: string,
  ): Promise<string | FetchModelsResponse> {
    const credentialsResult =
      await this.container.getCredentialsUseCase.execute();
    if (!credentialsResult.success) {
      return this.toErrorResponse(credentialsResult.error);
    }

    const apiKey = this.pickApiKey(credentialsResult.data, provider);
    if (!apiKey) {
      return this.toErrorResponse(
        new AuthError({
          message: 'No API key available for this provider. Add a key first.',
          userMessage:
            'No API key is configured for this provider. Add a key first.',
          context: { provider },
        }),
      );
    }

    return apiKey;
  }

  private pickApiKey(
    credentials: Credentials | null,
    provider: string,
  ): string | null {
    if (!credentials) return null;

    const providerKeys = credentials.getByProvider(provider);
    if (providerKeys.length === 0) return null;

    const active = credentials.getActive();
    const key =
      active && active.provider === provider ? active : providerKeys[0];
    return key.apiKey.value;
  }

  private toErrorResponse(error: AppError): FetchModelsResponse {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        userMessage: error.userMessage,
      },
    };
  }
}
