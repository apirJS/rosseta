import {
  APICallError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  RetryError,
  StreamProviderError,
  UnsupportedFunctionalityError,
} from 'ai';
import { AppError, AuthError, NetworkError, TranslationError, ErrorCode } from '../../../shared/errors';
import type { GenerationMode } from './ITranslationGenerationTransport';
import { readGenerationErrorDetails, type GenerationErrorDetails } from './generation-error-details';

export interface GenerationFailure {
  error: AppError;
  unsupported?: 'structured' | 'stream' | 'combination' | 'vision';
  general?: boolean;
  transient: boolean;
}

interface FailureContext extends GenerationErrorDetails {
  combined: string;
  allowsCapabilityEvidence: boolean;
  explicitlyUnsupported: boolean;
  namesStructuredFeature: boolean;
  namesFeature: boolean;
  invalidApplicationSchema: boolean;
}

const TRANSIENT_APPLICATION_ERRORS = new Set([
  ErrorCode.NETWORK_CONNECTION_FAILED,
  ErrorCode.NETWORK_PROVIDER_UNAVAILABLE,
  ErrorCode.NETWORK_INVALID_RESPONSE,
]);

export function unwrapGenerationError(error: unknown): unknown {
  let current = error;
  for (let depth = 0; depth < 5 && RetryError.isInstance(current); depth++) {
    current = current.lastError;
  }
  return current;
}

/** Precedence matters: request/access errors must never become capability facts. */
export function classifyGenerationError(unknownError: unknown, mode: GenerationMode): GenerationFailure {
  const error = unwrapGenerationError(unknownError);
  if (error instanceof AppError) {
    return failure(error, TRANSIENT_APPLICATION_ERRORS.has(error.code));
  }
  if (NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error)) {
    return failure(TranslationError.malformedResponse());
  }

  const context = createFailureContext(error);
  return classifyRequestFailure(context)
    ?? classifyModelOrCapabilityFailure(error, context, mode)
    ?? classifyTransportFailure(error, context)
    ?? failure(AppError.fromUnknown(error));
}

function createFailureContext(error: unknown): FailureContext {
  const details = readGenerationErrorDetails(error);
  const { status, message, code } = details;
  const combined = code + '\n' + message;
  const capabilityText = code.replace(/[_-]+/g, ' ') + '\n' + message;
  const namesStructuredFeature = /json[_\s-]*schema|response[_\s-]*format|structured[_\s-]+output/i.test(combined);
  return {
    ...details,
    combined,
    allowsCapabilityEvidence: status === 0 || [400, 422, 501].includes(status),
    explicitlyUnsupported: /\b(?:unsupported|unavailable|unimplemented|not[_\s]+(?:yet[_\s]+)?(?:supported|available|implemented)|does(?:\s+not|n't)\s+support|isn't\s+(?:supported|available))\b/i.test(capabilityText),
    namesStructuredFeature,
    namesFeature: namesStructuredFeature || /stream(?:ing)?|image|vision|multimodal/i.test(combined),
    invalidApplicationSchema: /invalid (?:json[_\s-]*)?schema|schema(?:\s+(?:is|was))?\s+invalid|schema.{0,30}(required|additionalProperties)|required.{0,30}schema|unsupported (?:json[_\s-]*)?schema (?:keyword|property)|schema.{0,30}(?:keyword|property|properties|syntax|definition).{0,30}(?:unsupported|not supported|invalid)/i.test(combined),
  };
}

function classifyRequestFailure(context: FailureContext): GenerationFailure | null {
  const { status, code, message, combined } = context;
  if (status === 401 || /invalid_token|token_auth_failed|unauthorized|invalid_api_key/.test(code)
    || /\b(?:invalid|incorrect|expired) (?:api[ -]?)?(?:key|token)\b|unauthori[sz]ed|authentication failed/i.test(message)) {
    return failure(AuthError.invalidApiKey());
  }
  if (/email_must_be_confirmed|email_confirmation_required/.test(code)) return failure(AuthError.accessDenied());
  if (status === 402 || /payment_required/.test(code)) return failure(AuthError.paymentRequired());
  if (status === 403) return failure(AuthError.accessDenied());
  if (/insufficient.{0,20}(quota|credit|balance|funds)|(?:quota|credit|balance).{0,30}(exceed|exhaust|deplet)|usage_limited|usage_limit|billing/i.test(combined)) {
    return failure(TranslationError.quotaExceeded());
  }
  if (status === 429 || /rate_limit|too_many_requests/.test(code) || /\brate limit|too many requests\b/i.test(message)) {
    return failure(TranslationError.rateLimited());
  }
  if (/content.{0,30}(blocked|filter|moderation|policy)|safety policy|unsafe content/i.test(combined)) {
    return failure(TranslationError.contentBlocked());
  }
  if (/context (length|window)|maximum context|too many tokens|token limit|input is too long/i.test(combined)) {
    return failure(TranslationError.contextLimit());
  }
  if (status === 413 || /image.{0,30}too large|image.{0,30}(size|dimensions).{0,30}(exceed|limit)|payload too large/i.test(combined)) {
    return failure(TranslationError.imageTooLarge());
  }
  if (/invalid_image|invalid image|bad_image|unsupported image (?:type|format|mime|media)/i.test(combined)) {
    return failure(TranslationError.invalidImage());
  }
  return null;
}

function classifyModelOrCapabilityFailure(
  error: unknown,
  context: FailureContext,
  mode: GenerationMode,
): GenerationFailure | null {
  const { status, code, message, combined } = context;
  const hasFeatureRejection = context.allowsCapabilityEvidence && !context.invalidApplicationSchema
    && context.explicitlyUnsupported && context.namesFeature;
  // Account-specific access and temporary outages are not model-wide evidence.
  if (hasFeatureRejection && /\b(?:account|api[_ -]?key|credential|subscription|plan|organization)\b/i.test(combined)) {
    return failure(AuthError.accessDenied());
  }
  if (hasFeatureRejection && /\btemporar(?:ily|y)\b|\b(?:service|backend|server) (?:is )?unavailable\b|\btry again\b/i.test(message)) {
    return failure(NetworkError.providerUnavailable(status, context.url), true);
  }
  if (context.allowsCapabilityEvidence && /does not support (?:image|vision|multimodal)|not (?:a )?(?:multimodal|vision)|only supports text|text.only model|image(?: input)? (?:is )?(?:unsupported|not supported)|unsupported image input/i.test(combined)) {
    return { error: TranslationError.modelNoVision(message), unsupported: 'vision', general: true, transient: false };
  }
  if (status === 404 || /unknown_model|model_not_found|model_not_supported/.test(code)
    || /\b(?:unknown model|model (?:is )?(?:not found|unavailable))\b/i.test(message)) {
    return failure(TranslationError.modelNotFound());
  }
  if (!isCapabilityError(error, context) || context.invalidApplicationSchema || !context.explicitlyUnsupported) return null;
  if (mode === 'structured-stream' && /stream/i.test(combined)
    && (context.namesStructuredFeature || /\bstructured\b/i.test(combined))) {
    return unsupported('combination');
  }
  if (context.namesStructuredFeature && mode.startsWith('structured')) return unsupported('structured', true);
  if (/stream(?:ing)?/i.test(combined) && mode.endsWith('stream')) return unsupported('stream', true);
  return null;
}

function isCapabilityError(error: unknown, context: FailureContext): boolean {
  if (!context.allowsCapabilityEvidence) return false;
  const typedErrorChunk = typeof error === 'object' && error !== null && 'type' in error && error.type === 'error';
  return APICallError.isInstance(error)
    || StreamProviderError.isInstance(error)
    || UnsupportedFunctionalityError.isInstance(error)
    || typedErrorChunk
    || [400, 422, 501].includes(context.status)
    || /unsupported|not_supported/.test(context.code);
}

function classifyTransportFailure(error: unknown, context: FailureContext): GenerationFailure | null {
  const { status, url, combined } = context;
  if (status === 408 || status === 504 || error instanceof Error && /AbortError|TimeoutError/.test(error.name)) {
    return failure(NetworkError.timeout(url));
  }
  if (APICallError.isInstance(error) && status >= 200 && status < 300 && error.cause instanceof Error
    && (error.cause instanceof TypeError || /network|connection|terminated|socket|unexpected end|stream interrupted/i.test(error.cause.message))) {
    return failure(NetworkError.connectionFailed(url, error.cause), true);
  }
  if (status >= 500) return failure(NetworkError.providerUnavailable(status, url), true);
  if ([400, 409, 422].includes(status)) return failure(TranslationError.requestRejected());
  if (error instanceof TypeError || /network|connection|failed to fetch|invalid_stream_response|premature|terminated|socket|unexpected end|stream interrupted/i.test(combined)) {
    return failure(NetworkError.connectionFailed(url, error instanceof Error ? error : undefined), true);
  }
  return null;
}

function failure(error: AppError, transient = false): GenerationFailure {
  return { error, transient };
}

function unsupported(kind: NonNullable<GenerationFailure['unsupported']>, general = false): GenerationFailure {
  return { error: TranslationError.requestRejected(), unsupported: kind, general, transient: false };
}
