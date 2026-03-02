import type { IApiKeyValidator } from '../../../core/ports/outbound/IApiKeyValidator';
import type { Provider } from '../../../core/domain/credential/Provider';
import { success, failure, type Result } from '../../../shared/types/Result';
import { AuthError, NetworkError, type AppError } from '../../../shared/errors';

const GEMINI_API_VALIDATION_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

export class HttpApiKeyValidator implements IApiKeyValidator {
  async validate(
    apiKey: string,
    provider: Provider,
  ): Promise<Result<void, AppError>> {
    if (provider === 'gemini') {
      return this.validateGeminiKey(apiKey);
    }
    if (provider === 'zai') {
      return this.validateZaiKey(apiKey);
    }
    return this.validateGroqKey(apiKey);
  }

  private async validateGeminiKey(
    apiKey: string,
  ): Promise<Result<void, AppError>> {
    try {
      const response = await fetch(
        `${GEMINI_API_VALIDATION_URL}?key=${apiKey}`,
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error?.message || 'Invalid API key';

        if (response.status === 400 || response.status === 403) {
          return failure(AuthError.invalidApiKey(errorMessage));
        }

        return failure(
          NetworkError.serverError(response.status, GEMINI_API_VALIDATION_URL),
        );
      }

      const data = await response.json();
      if (!data.models || !Array.isArray(data.models)) {
        return failure(AuthError.invalidApiKey('Unexpected API response'));
      }

      return success(undefined);
    } catch (error) {
      return failure(
        NetworkError.fromFetchError(
          error instanceof Error ? error : new Error('Unknown error'),
          GEMINI_API_VALIDATION_URL,
        ),
      );
    }
  }

  private async validateGroqKey(
    apiKey: string,
  ): Promise<Result<void, AppError>> {
    const modelsUrl = 'https://api.groq.com/openai/v1/models';
    try {
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return failure(AuthError.invalidApiKey());
        }

        if (response.status === 429) {
          return failure(NetworkError.serverError(429, modelsUrl));
        }

        return failure(NetworkError.serverError(response.status, modelsUrl));
      }

      const data = await response.json();
      if (!data.data || !Array.isArray(data.data)) {
        return failure(AuthError.invalidApiKey('Unexpected API response'));
      }

      return success(undefined);
    } catch (error) {
      return failure(
        NetworkError.fromFetchError(
          error instanceof Error ? error : new Error('Unknown error'),
          modelsUrl,
        ),
      );
    }
  }

  private async validateZaiKey(
    apiKey: string,
  ): Promise<Result<void, AppError>> {
    const modelsUrl = 'https://api.z.ai/api/paas/v4/models';
    try {
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Accept-Language': 'en-US,en',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return failure(AuthError.invalidApiKey());
        }

        if (response.status === 429) {
          return failure(NetworkError.serverError(429, modelsUrl));
        }

        return failure(NetworkError.serverError(response.status, modelsUrl));
      }

      const data = await response.json();
      if (!data.data || !Array.isArray(data.data)) {
        return failure(AuthError.invalidApiKey('Unexpected API response'));
      }

      return success(undefined);
    } catch (error) {
      return failure(
        NetworkError.fromFetchError(
          error instanceof Error ? error : new Error('Unknown error'),
          modelsUrl,
        ),
      );
    }
  }
}
