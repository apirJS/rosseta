import {
  APICallError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  StreamProviderError,
  UnsupportedFunctionalityError,
} from 'ai';
import {
  AppError,
  AuthError,
  NetworkError,
  TranslationError,
  ErrorCode,
} from '../../../../shared/errors';
import type { GenerationConfiguration } from '../transports/GenerationTransport';
import type { GenerationMode } from '../transports/generation-modes';
import {
  readGenerationErrorDetails,
  unwrapGenerationError,
  type GenerationErrorDetails,
} from './provider-error-details';
import { matchConfigurationRejection } from './configuration-rejection';

export type GenerationFailure =
  | { kind: 'terminal'; error: AppError }
  | { kind: 'transient'; error: AppError }
  | { kind: 'configuration-rejected'; configurationId: string; error: AppError }
  | {
      kind: 'configuration-mode-rejected';
      configurationId: string;
      mode: GenerationMode;
      reason: 'structured' | 'stream' | 'combination';
      error: AppError;
    }
  | {
      kind: 'feature-rejected';
      feature: 'structured' | 'stream' | 'vision';
      error: AppError;
    }
  | { kind: 'mode-rejected'; mode: GenerationMode; error: AppError };

interface ActiveGenerationRequest {
  mode: GenerationMode;
  configuration?: GenerationConfiguration;
}

interface FailureContext extends GenerationErrorDetails {
  combined: string;
  sdkUnsupported: boolean;
  allowsCapabilityEvidence: boolean;
  explicitlyUnsupported: boolean;
  namesStructuredFeature: boolean;
  namesFeature: boolean;
  invalidApplicationSchema: boolean;
}

const TRANSIENT_APPLICATION_ERRORS = new Set([
  ErrorCode.NETWORK_TIMEOUT,
  ErrorCode.NETWORK_CONNECTION_FAILED,
  ErrorCode.NETWORK_PROVIDER_UNAVAILABLE,
  ErrorCode.NETWORK_INVALID_RESPONSE,
]);

/** Precedence matters: request/access errors must never become capability facts. */
export function classifyGenerationFailure(
  unknownError: unknown,
  { mode, configuration }: ActiveGenerationRequest,
): GenerationFailure {
  const error = unwrapGenerationError(unknownError);

  if (error instanceof AppError) {
    return failure(error, TRANSIENT_APPLICATION_ERRORS.has(error.code));
  }

  if (
    NoObjectGeneratedError.isInstance(error) ||
    NoOutputGeneratedError.isInstance(error)
  ) {
    return failure(TranslationError.malformedResponse());
  }

  const context = createFailureContext(error);
  const requestFailure = classifyRequestFailure(context);

  if (requestFailure) return requestFailure;

  const modelFailure = classifyModelOrCapabilityFailure(error, context, mode);

  if (
    modelFailure &&
    (modelFailure.kind === 'terminal' ||
      modelFailure.kind === 'transient' ||
      (modelFailure.kind === 'feature-rejected' &&
        modelFailure.feature === 'vision'))
  )
    return modelFailure;

  const classified =
    modelFailure ??
    classifyTransportFailure(error, context) ??
    failure(AppError.fromUnknown(error));

  return (
    classifyConfigurationFailure(
      error,
      context,
      mode,
      configuration,
      classified,
    ) ?? classified
  );
}

function classifyConfigurationFailure(
  error: unknown,
  context: FailureContext,
  mode: GenerationMode,
  configuration: GenerationConfiguration | undefined,
  classified: GenerationFailure,
): GenerationFailure | null {
  if (
    !configuration ||
    !permitsConfigurationEvidence(error, context, context.sdkUnsupported) ||
    excludesConfigurationEvidence(context)
  )
    return null;

  const rejection = matchConfigurationRejection(
    {
      text: context.combined.replace(/[_-]+/g, ' '),
      parameters: context.parameters,
      sdkUnsupported: context.sdkUnsupported,
    },
    configuration.rejectionFields,
  );

  if (rejection === 'configuration')
    return {
      kind: 'configuration-rejected',
      configurationId: configuration.id,
      error: classified.error,
    };

  if (rejection === 'configuration-mode')
    return {
      kind: 'configuration-mode-rejected',
      configurationId: configuration.id,
      mode,
      reason:
        classified.kind === 'feature-rejected' &&
        (classified.feature === 'structured' || classified.feature === 'stream')
          ? classified.feature
          : 'combination',
      error: classified.error,
    };

  return null;
}

function createFailureContext(error: unknown): FailureContext {
  const details = readGenerationErrorDetails(error);
  const { status, message, code } = details;
  const sdkUnsupported = UnsupportedFunctionalityError.isInstance(error);

  const combined =
    code + '\n' + message + (sdkUnsupported ? '\n' + error.functionality : '');

  const capabilityText = combined.replace(/[_-]+/g, ' ');

  const namesStructuredFeature =
    /json[_\s-]*schema|response[_\s-]*format|structured[_\s-]+output/i.test(
      combined,
    );

  return {
    ...details,
    combined,
    sdkUnsupported,
    allowsCapabilityEvidence:
      !(StreamProviderError.isInstance(error) && error.isRetryable) &&
      (status === 0 ||
        [400, 422, 501].includes(status) ||
        (status >= 200 && status < 300 && isProviderErrorEnvelope(error))),
    explicitlyUnsupported:
      sdkUnsupported ||
      /\b(?:unsupported|unavailable|unimplemented|not[_\s]+(?:yet[_\s]+)?(?:supported|available|implemented)|does(?:\s+not|n't)\s+support|isn't\s+(?:supported|available))\b/i.test(
        capabilityText,
      ),
    namesStructuredFeature,
    namesFeature:
      namesStructuredFeature ||
      /stream(?:ing)?|image|vision|multimodal/i.test(combined),
    invalidApplicationSchema:
      /invalid (?:json[_\s-]*)?schema|schema(?:\s+(?:is|was))?\s+invalid|schema.{0,30}(required|additionalProperties)|required.{0,30}schema|unsupported (?:json[_\s-]*)?schema (?:keyword|property)|schema.{0,30}(?:keyword|property|properties|syntax|definition).{0,30}(?:unsupported|not supported|invalid)/i.test(
        capabilityText,
      ),
  };
}

function classifyRequestFailure(
  context: FailureContext,
): GenerationFailure | null {
  const { status, code, message } = context;
  const combined = context.combined.replace(/[_-]+/g, ' ');

  if (
    status === 401 ||
    /invalid_token|token_auth_failed|unauthorized|invalid_api_key|unauthenticated|authentication_(?:error|failed|required)/.test(
      code,
    ) ||
    /\b(?:invalid|incorrect|expired) (?:api[ -]?)?(?:key|token)\b|unauthori[sz]ed|authentication failed/i.test(
      message,
    )
  ) {
    return failure(AuthError.invalidApiKey());
  }

  if (/email_must_be_confirmed|email_confirmation_required/.test(code))
    return failure(AuthError.accessDenied());

  if (status === 402 || /payment_required/.test(code))
    return failure(AuthError.paymentRequired());

  if (
    status === 403 ||
    /permission_denied|access_denied|(?:^|\n)forbidden(?:\n|$)/.test(code) ||
    /\b(?:permission|access) denied\b/i.test(message)
  )
    return failure(AuthError.accessDenied());

  if (
    /insufficient.{0,20}(quota|credit|balance|funds)|(?:quota|credit|balance).{0,30}(exceed|exhaust|deplet)|usage limit|billing/i.test(
      combined,
    )
  ) {
    return failure(TranslationError.quotaExceeded());
  }

  if (
    status === 429 ||
    /rate_limit|too_many_requests/.test(code) ||
    /\brate limit|too many requests\b/i.test(message)
  ) {
    return failure(TranslationError.rateLimited());
  }

  if (
    /content.{0,30}(blocked|filter|moderation|policy)|safety policy|unsafe content/i.test(
      combined,
    )
  ) {
    return failure(TranslationError.contentBlocked());
  }

  if (
    /context (length|window)|maximum context|too many tokens|token limit|input is too long/i.test(
      combined,
    )
  ) {
    return failure(TranslationError.contextLimit());
  }

  if (
    status === 413 ||
    /image.{0,30}too large|image[^\n]{0,80}(?:size|dimensions?)[^\n]{0,80}(?:exceed|limit)|payload too large/i.test(
      combined,
    )
  ) {
    return failure(TranslationError.imageTooLarge());
  }

  if (
    /(?:invalid|bad) image|unsupported image(?: input)? (?:type|format|mime|media)/i.test(
      combined,
    )
  ) {
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

  const hasFeatureRejection =
    isCapabilityError(error, context) &&
    !context.invalidApplicationSchema &&
    context.explicitlyUnsupported &&
    context.namesFeature;

  // Account-specific access and temporary outages are not model-wide evidence.
  if (
    hasFeatureRejection &&
    /\b(?:account|api[_ -]?key|credential|subscription|plan|organization|project|tier)\b/i.test(
      combined,
    )
  ) {
    return failure(AuthError.accessDenied());
  }

  if (
    hasFeatureRejection &&
    /\btemporar(?:ily|y)\b|\b(?:service|backend|server) (?:is )?unavailable\b|\btry again\b/i.test(
      message,
    )
  ) {
    return failure(NetworkError.providerUnavailable(status, context.url), true);
  }

  if (
    isCapabilityError(error, context) &&
    /does not support (?:image|vision|multimodal)|not (?:a )?(?:multimodal|vision)|only supports text|text.only model|image(?: input)? (?:is )?(?:unsupported|not supported)|unsupported image input/i.test(
      combined,
    )
  ) {
    return {
      error: TranslationError.modelNoVision(message),
      kind: 'feature-rejected',
      feature: 'vision',
    };
  }

  if (
    status === 404 ||
    /unknown_model|model_not_found|model_not_supported/.test(code) ||
    /\b(?:unknown model|model (?:is )?(?:not found|unavailable))\b/i.test(
      message,
    )
  ) {
    return failure(TranslationError.modelNotFound());
  }

  if (
    !isCapabilityError(error, context) ||
    context.invalidApplicationSchema ||
    !context.explicitlyUnsupported
  )
    return null;

  if (
    mode === 'structured-stream' &&
    /stream/i.test(combined) &&
    (context.namesStructuredFeature || /\bstructured\b/i.test(combined))
  ) {
    return {
      kind: 'mode-rejected',
      mode,
      error: TranslationError.requestRejected(),
    };
  }

  if (context.namesStructuredFeature && mode.startsWith('structured'))
    return rejectFeature('structured');

  if (/stream(?:ing)?/i.test(combined) && mode.endsWith('stream'))
    return rejectFeature('stream');

  return null;
}

function isCapabilityError(error: unknown, context: FailureContext): boolean {
  if (!context.allowsCapabilityEvidence) return false;

  return (
    APICallError.isInstance(error) ||
    UnsupportedFunctionalityError.isInstance(error) ||
    isProviderErrorEnvelope(error) ||
    [400, 422, 501].includes(context.status) ||
    /unsupported|not_supported/.test(context.code)
  );
}

function isProviderErrorEnvelope(error: unknown): boolean {
  return (
    StreamProviderError.isInstance(error) ||
    (typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      error.type === 'error')
  );
}

function classifyTransportFailure(
  error: unknown,
  context: FailureContext,
): GenerationFailure | null {
  const { status, url, combined } = context;

  if (
    status === 408 ||
    status === 504 ||
    (error instanceof Error && /AbortError|TimeoutError/.test(error.name))
  ) {
    return failure(NetworkError.timeout(url), true);
  }

  if (
    APICallError.isInstance(error) &&
    status >= 200 &&
    status < 300 &&
    error.cause instanceof Error &&
    (error.cause instanceof TypeError ||
      /network|connection|terminated|socket|unexpected end|stream interrupted/i.test(
        error.cause.message,
      ))
  ) {
    return failure(NetworkError.connectionFailed(url, error.cause), true);
  }

  if (status >= 500)
    return failure(NetworkError.providerUnavailable(status, url), true);
  if (StreamProviderError.isInstance(error) && error.isRetryable)
    return failure(NetworkError.providerUnavailable(status, url), true);
  if ([400, 409, 422].includes(status))
    return failure(TranslationError.requestRejected());

  if (
    error instanceof TypeError ||
    /network|connection|failed to fetch|invalid_stream_response|premature|terminated|socket|unexpected end|stream interrupted/i.test(
      combined,
    )
  ) {
    return failure(
      NetworkError.connectionFailed(
        url,
        error instanceof Error ? error : undefined,
      ),
      true,
    );
  }

  return null;
}

function failure(error: AppError, transient = false): GenerationFailure {
  return { kind: transient ? 'transient' : 'terminal', error };
}

function rejectFeature(feature: 'structured' | 'stream'): GenerationFailure {
  return {
    kind: 'feature-rejected',
    feature,
    error: TranslationError.requestRejected(),
  };
}

function permitsConfigurationEvidence(
  error: unknown,
  details: GenerationErrorDetails,
  sdkUnsupported: boolean,
): boolean {
  if (StreamProviderError.isInstance(error) && error.isRetryable) return false;
  if ([400, 422, 501].includes(details.status)) return true;
  if (details.status !== 0 && (details.status < 200 || details.status >= 300))
    return false;
  if (sdkUnsupported) return true;
  if (!hasConfigurationErrorCode(details.code)) return false;
  if (StreamProviderError.isInstance(error)) return !error.isRetryable;

  return isTypedProviderEnvelope(error);
}

function isTypedProviderEnvelope(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if (
    'type' in error &&
    (error.type === 'error' || error.type === 'invalid_request_error')
  )
    return true;

  return (
    'success' in error &&
    error.success === false &&
    'error' in error &&
    typeof error.error === 'object' &&
    error.error !== null
  );
}

function hasConfigurationErrorCode(code: string): boolean {
  return /(?:^|\n)(?:invalid_request(?:_error)?|(?:unsupported|invalid|unrecognized)_(?:parameter|argument|value|feature))(?:\n|$)/i.test(
    code,
  );
}

/** Control evidence excludes unrelated failure prose more strictly than general mapping. */
function excludesConfigurationEvidence({
  code,
  message,
  invalidApplicationSchema,
}: FailureContext): boolean {
  const text = (code + '\n' + message).replace(/[_-]+/g, ' ');

  return (
    invalidApplicationSchema ||
    isAccessFailure(text) ||
    isTemporaryFailure(text)
  );
}

function isAccessFailure(text: string): boolean {
  return (
    /invalid token|token auth failed|unauthorized|payment required|unknown model|model not found|model not supported/i.test(
      text,
    ) ||
    /permission denied|access denied|forbidden|unauthenticated|email must be confirmed|email confirmation required|authentication (?:failed|error|required)/i.test(
      text,
    ) ||
    /\b(?:account|api[ -]?key|credential|subscription|organization|plan|project|tier)\b|unauthori[sz]ed|authentication failed|\b(?:invalid|incorrect|expired) (?:api[ -]?)?(?:key|token)\b/i.test(
      text,
    ) ||
    /insufficient.{0,20}(?:quota|credit|balance|funds)|(?:quota|credit|balance).{0,30}(?:exceed|exhaust|deplet)|usage limited|usage limit|billing|\brate limit|too many requests\b/i.test(
      text,
    )
  );
}

function isTemporaryFailure(text: string): boolean {
  return /\btemporar(?:ily|y)\b|\b(?:service|backend|server) (?:is )?unavailable\b|\btry again\b|network|connection|timeout|timed out/i.test(
    text,
  );
}
