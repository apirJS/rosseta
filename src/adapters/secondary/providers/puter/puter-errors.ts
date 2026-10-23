import type { ChatResponse } from '@heyputer/puter.js';
import type { ICancellationToken } from '../../../../core/ports/outbound/ICancellationToken';
import {
  AppError,
  AuthError,
  ErrorCode,
  NetworkError,
  TranslationError,
} from '../../../../shared/errors';

export function responseText(response: ChatResponse): string {
  const content = response.message?.content;

  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .filter(
      (
        part,
      ): part is {
        text: string;
      } =>
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

  const rootStatus = numberValue(root?.statusCode) ?? numberValue(root?.status);

  const nestedStatus =
    numberValue(nested?.statusCode) ?? numberValue(nested?.status);

  const status =
    rootStatus === null ||
    (rootStatus >= 200 && rootStatus < 300 && (nestedStatus ?? 0) >= 400)
      ? (nestedStatus ?? 0)
      : rootStatus;

  const code = stringValue(root?.code) ?? stringValue(nested?.code) ?? '';

  const message =
    stringValue(root?.message) ??
    stringValue(nested?.message) ??
    stringValue(root?.reason) ??
    (error instanceof Error ? error.message : String(error));

  return {
    status,
    code: code.toLowerCase(),
    message,
    usageLimited:
      asRecord(root?.metadata)?.usage_limited === true ||
      asRecord(nested?.metadata)?.usage_limited === true,
  };
}

export function mapPuterError(
  error: unknown,
  cancellationToken?: ICancellationToken,
): AppError {
  if (cancellationToken?.isCancellationRequested) {
    return TranslationError.cancelled();
  }

  if (error instanceof AppError) return error;

  const details = errorDetails(error);
  const { status, code, message, usageLimited } = details;

  if (
    status === 401 ||
    /auth|unauthori[sz]|reauth/.test(code) ||
    /(?:invalid|expired|missing|bad|no)[_-]+(?:access[_-]+)?token|token[_-]+(?:invalid|expired|missing|revoked)/.test(
      code,
    ) ||
    /(?:invalid|expired|missing)[_-]+api[_-]+key/.test(code)
  ) {
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

  if (
    usageLimited ||
    /insufficient_funds|usage_limit|usage_limited/.test(code)
  ) {
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

  if (
    status === 429 ||
    /rate_limit|rate_limited|too_many_requests/.test(code)
  ) {
    return TranslationError.rateLimited();
  }

  if (status === 408 || status === 504) return NetworkError.timeout();
  if (status >= 500) return NetworkError.providerUnavailable(status);
  if (status === 413) return TranslationError.imageTooLarge();

  if (
    status === 404 ||
    /model.*(?:not_found|not_supported)|unknown_model/.test(code) ||
    /model.*(?:not found|not supported)|unknown model/i.test(message)
  ) {
    return TranslationError.modelNotFound();
  }

  if (
    /content_policy|content_filter|safety|moderation/.test(code) ||
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
    /image.{0,80}(?:too large|(?:size|dimensions).{0,40}(?:exceed|limit))|payload.*too large/i.test(
      message,
    )
  ) {
    return TranslationError.imageTooLarge();
  }

  if (
    /invalid_image|image.*invalid|bad_image|unsupported_image_(?:input_)?(?:type|format|mime|media)/.test(
      code,
    ) ||
    /invalid image|image payload|unsupported image (?:input )?(?:type|format|mime|media)/i.test(
      message,
    )
  ) {
    return TranslationError.invalidImage();
  }

  const featureText = (code + '\n' + message).replace(/[_-]+/g, ' ');

  if (
    /does not support (?:images?|vision|multimodal)|not (?:a )?(?:multimodal|vision) model|only supports text|supports text only|text.only model|(?:image(?: input)?|vision|multimodal) (?:is )?(?:unsupported|not supported)|unsupported (?:image input|vision|multimodal)|no vision/i.test(
      featureText,
    )
  ) {
    return TranslationError.modelNoVision(message);
  }

  if (
    /empty_response|no_output/.test(code) ||
    /empty response|no output/i.test(message)
  ) {
    return TranslationError.emptyResponse();
  }

  if (
    [400, 409, 422].includes(status) ||
    /invalid_request|bad_request|unsupported/.test(code)
  ) {
    return TranslationError.requestRejected(message);
  }

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
