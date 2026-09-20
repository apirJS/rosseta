import puterSdk, { type ChatResponse } from '@heyputer/puter.js';
import type { ITranslationService } from '../../../core/ports/outbound/ITranslationService';
import type { ICancellationToken } from '../../../core/ports/outbound/ICancellationToken';
import type { Credential } from '../../../core/domain/credential/Credential';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { Translation } from '../../../core/domain/translation/Translation';
import type { Language } from '../../../core/domain/translation/Language';
import type { UserPreferences } from '../../../core/domain/preferences/UserPreferences';
import type { Result } from '../../../shared/types/Result';
import { failure } from '../../../shared/types/Result';
import {
  AppError,
  AuthError,
  ErrorCode,
  NetworkError,
  TranslationError,
} from '../../../shared/errors';
import { buildPlainPrompt } from '../shared/prompt-base';
import { parseTranslationResponse } from '../shared/parse-translation-json';
import { mapResponseToDomain } from '../shared/translation-response-mapper';

function responseText(response: ChatResponse): string {
  const content = response.message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(
      (part): part is { text: string } =>
        typeof part === 'object' &&
        part !== null &&
        'text' in part &&
        typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join('');
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null
    ? (value as UnknownRecord)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function numberValue(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

interface PuterErrorDetails {
  status: number;
  code: string;
  message: string;
  usageLimited: boolean;
}

function errorDetails(error: unknown): PuterErrorDetails {
  const root = asRecord(error);
  const nested = asRecord(root?.error);
  const status =
    numberValue(root?.status) ??
    numberValue(nested?.status) ??
    numberValue(root?.statusCode) ??
    0;
  const code =
    stringValue(root?.code) ??
    stringValue(nested?.code) ??
    '';
  const message =
    stringValue(root?.message) ??
    stringValue(nested?.message) ??
    stringValue(root?.reason) ??
    (error instanceof Error ? error.message : String(error));
  const metadata = asRecord(root?.metadata) ?? asRecord(nested?.metadata);
  return {
    status,
    code: code.toLowerCase(),
    message,
    usageLimited: metadata?.usage_limited === true,
  };
}

function mapPuterError(
  error: unknown,
  cancellationToken?: ICancellationToken,
): AppError {
  if (cancellationToken?.isCancellationRequested) {
    return TranslationError.failed(new Error('Translation cancelled'));
  }
  const details = errorDetails(error);
  const { status, code, message, usageLimited } = details;
  if (status === 401 || /auth|token|unauthori[sz]|reauth/.test(code)) {
    return new AuthError({
      code: ErrorCode.AUTH_INVALID_API_KEY,
      userMessage:
        'Invalid Puter token. Copy a fresh token from Puter account settings.',
    });
  }
  if (/email_must_be_confirmed/.test(code)) {
    return new AuthError({
      code: ErrorCode.AUTH_ACCESS_DENIED,
      userMessage: 'Confirm your Puter email before using this token.',
    });
  }
  if (usageLimited || /insufficient_funds|usage_limit|usage_limited/.test(code)) {
    return TranslationError.quotaExceeded();
  }
  if (status === 402 || /payment_required/.test(code)) {
    return AuthError.paymentRequired();
  }
  if (
    status === 403 ||
    /permission_denied|forbidden|access_denied/.test(code)
  ) {
    return AuthError.accessDenied();
  }
  if (status === 429 || /rate_limit|rate_limited|too_many_requests/.test(code)) {
    return TranslationError.rateLimited();
  }
  if (
    status === 404 ||
    /model.*(?:not_found|not_supported)|unknown_model/.test(code) ||
    /model.*(?:not found|not supported)|unknown model/i.test(message)
  ) {
    return TranslationError.modelNotFound();
  }
  if (
    /vision|image_input|multimodal|no_image|image.*(?:unsupported|not supported)/.test(
      code,
    ) ||
    /vision|image input|multimodal|does not support images|text.only model/i.test(
      message,
    )
  ) {
    return TranslationError.modelNoVision(message);
  }
  if (
    /content_policy|safety|moderation/.test(code) ||
    /content.*(?:blocked|rejected)|safety policy|moderation/i.test(message)
  ) {
    return TranslationError.contentBlocked();
  }
  if (
    /context|prompt.*long|request.*large|token.*limit/.test(code) ||
    /context window|prompt.*too long|maximum.*tokens/i.test(message)
  ) {
    return TranslationError.contextLimit();
  }
  if (
    /image.*(?:large|size)|payload.*large/.test(code) ||
    /image.*too large|payload.*too large/i.test(message)
  ) {
    return TranslationError.imageTooLarge();
  }
  if (
    /invalid_image|image.*invalid|bad_image/.test(code) ||
    /invalid image|image payload/i.test(message)
  ) {
    return TranslationError.invalidImage();
  }
  if (
    /empty_response|no_output/.test(code) ||
    /empty response|no output/i.test(message)
  ) {
    return TranslationError.emptyResponse();
  }
  if (/invalid_request|bad_request|unsupported/.test(code)) {
    return TranslationError.requestRejected(message);
  }
  if (status >= 500) return NetworkError.providerUnavailable(status);
  if (
    (error instanceof Error && /abort|timeout/i.test(error.name)) ||
    /abort|timeout|timed out/.test(code + ' ' + message)
  ) {
    return NetworkError.timeout();
  }
  const record = asRecord(error);
  const looksLikeXhr =
    record !== null &&
    ('readyState' in record ||
      'responseText' in record ||
      'statusText' in record);
  if (
    looksLikeXhr ||
    error instanceof TypeError ||
    /network|connection|failed to fetch/i.test(message)
  ) {
    return NetworkError.connectionFailed(
      undefined,
      error instanceof Error ? error : undefined,
    );
  }
  return AppError.fromUnknown(error, ErrorCode.TRANSLATION_FAILED);
}

export class PuterTranslationAdapter implements ITranslationService {
  constructor(
    private readonly credential: Credential,
    private readonly userPreferences: UserPreferences,
  ) {}

  async translateImage(
    image: EncodedImage,
    targetLanguage: Language,
    cancellationToken?: ICancellationToken,
  ): Promise<Result<Translation, AppError>> {
    if (cancellationToken?.isCancellationRequested) {
      return failure(TranslationError.failed(new Error('Translation cancelled')));
    }

    const token = this.credential.apiKey.value;
    if (puterSdk.authToken !== token) {
      puterSdk.setAuthToken(token);
    }
    const prompt = buildPlainPrompt({
      targetLanguageCode: targetLanguage.code,
      targetLanguageName: targetLanguage.name,
      includeDescription: this.userPreferences.includeDescription,
    });
    const model = this.userPreferences.getModelIdFor('puter');

    try {
      const response = await puterSdk.ai.chat(prompt, image.value, {
        model,
        temperature: 0,
        normalize: true,
      });
      if (cancellationToken?.isCancellationRequested) {
        return failure(TranslationError.failed(new Error('Translation cancelled')));
      }
      const parsed = parseTranslationResponse(responseText(response));
      if (!parsed.success) return failure(parsed.error);
      if (!parsed.data.success || !parsed.data.data) {
        return failure(
          TranslationError.aiRejected(parsed.data.error ?? 'Unknown error'),
        );
      }
      return mapResponseToDomain(parsed.data.data, targetLanguage, 'PUTER');
    } catch (error) {
      return failure(mapPuterError(error, cancellationToken));
    }
  }
}
