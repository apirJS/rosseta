import type { IApiKeyValidator } from '../../../core/ports/outbound/IApiKeyValidator';
import type { Provider } from '../../../core/domain/credential/Provider';
import { success, failure, type Result } from '../../../shared/types/Result';
import { AuthError, NetworkError, type AppError } from '../../../shared/errors';

const GEMINI_API_VALIDATION_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

const GROQ_API_VALIDATION_URL =
  'https://api.groq.com/openai/v1/chat/completions';

export class HttpApiKeyValidator implements IApiKeyValidator {
  async validate(
    apiKey: string,
    provider: Provider,
  ): Promise<Result<void, AppError>> {
    if (provider === 'gemini') {
      return this.validateGeminiKey(apiKey);
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
    try {
      const response = await fetch(GROQ_API_VALIDATION_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: 'echo' }],
          max_tokens: 1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData?.error?.message || 'Invalid Groq API key';

        if (response.status === 401 || response.status === 403) {
          return failure(AuthError.invalidApiKey(errorMessage));
        }

        if (response.status === 429) {
          return failure(
            NetworkError.serverError(429, GROQ_API_VALIDATION_URL),
          );
        }

        return failure(
          NetworkError.serverError(response.status, GROQ_API_VALIDATION_URL),
        );
      }

      return success(undefined);
    } catch (error) {
      return failure(
        NetworkError.fromFetchError(
          error instanceof Error ? error : new Error('Unknown error'),
          GROQ_API_VALIDATION_URL,
        ),
      );
    }
  }
}
