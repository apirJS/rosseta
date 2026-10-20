import { StreamProviderError, UnsupportedFunctionalityError } from 'ai';
import {
  readGenerationErrorDetails,
  type GenerationErrorDetails,
} from './generation-error-details';
import { unwrapGenerationError } from './generation-errors';

/** Only explicit rejection of a control actually sent can teach compatibility. */
export function isConfigurationRejection(
  error: unknown,
  fields: readonly string[],
): boolean {
  if (!fields.length) return false;

  const unwrapped = unwrapGenerationError(error);
  const details = readGenerationErrorDetails(unwrapped);
  const sdkUnsupported = UnsupportedFunctionalityError.isInstance(unwrapped);

  if (!permitsConfigurationEvidence(unwrapped, details, sdkUnsupported))
    return false;

  if (hasUnrelatedFailure(details)) return false;

  const activeFields = fields
    .map(fieldPattern)
    .filter((pattern): pattern is RegExp => pattern !== null);

  const parameterNames = details.parameters;

  if (
    parameterNames.length &&
    !parameterNames.some((name) => namesActiveField(name, activeFields))
  )
    return false;

  const text = (
    details.code +
    '\n' +
    details.message +
    '\n' +
    (sdkUnsupported ? unwrapped.functionality : '')
  ).replace(/[_-]+/g, ' ');

  if (!parameterNames.length && !namesActiveField(text, activeFields))
    return false;

  return sdkUnsupported || explicitlyRejectsConfiguration(text);
}

function permitsConfigurationEvidence(
  error: unknown,
  details: GenerationErrorDetails,
  sdkUnsupported: boolean,
): boolean {
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

function namesActiveField(text: string, fields: readonly RegExp[]): boolean {
  return fields.some((field) => field.test(text));
}

function fieldPattern(value: string): RegExp | null {
  const words = value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .match(/[a-z0-9]+/g);

  return words?.length
    ? new RegExp(
        `(?:^|[^a-z0-9_])${words.join('[\\s_.-]*')}(?=$|[^a-z0-9_])`,
        'i',
      )
    : null;
}

function explicitlyRejectsConfiguration(text: string): boolean {
  return (
    /\b(?:unsupported|unavailable|unimplemented|unrecognized|unrecognised|unknown|unexpected|forbidden|not (?:yet )?(?:supported|allowed|permitted|available|implemented)|does(?:\s+not|n't)\s+support|isn't\s+supported)\b/i.test(
      text,
    ) ||
    /\b(?:invalid|incorrect|unacceptable|illegal)\s+(?:value|parameter|argument|option|setting)\b/i.test(
      text,
    ) ||
    /\b(?:only\s+(?:supports?|allows?)|must\s+(?:not\s+)?(?:be|equal|have|enable|include)|input should be|(?:is|are)\s+(?:required|mandatory)|cannot\s+(?:be\s+)?disable(?:d)?)\b/i.test(
      text,
    )
  );
}

function hasUnrelatedFailure({
  code,
  message,
}: GenerationErrorDetails): boolean {
  const text = (code + '\n' + message).replace(/[_-]+/g, ' ');

  return (
    isAccessFailure(text) ||
    isTemporaryFailure(text) ||
    isInputFailure(text) ||
    isConditionalModeRejection(text)
  );
}

function isAccessFailure(text: string): boolean {
  return (
    /invalid token|token auth failed|unauthorized|payment required|unknown model|model not found|model not supported/i.test(
      text,
    ) ||
    /permission denied|access denied|email must be confirmed|email confirmation required|authentication (?:failed|error|required)/i.test(
      text,
    ) ||
    /\b(?:account|api[ -]?key|credential|subscription|organization|plan)\b|unauthori[sz]ed|authentication failed|\b(?:invalid|incorrect|expired) (?:api[ -]?)?(?:key|token)\b/i.test(
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

function isInputFailure(text: string): boolean {
  return (
    /content.{0,30}(?:blocked|filter|moderation|policy)|safety policy|unsafe content|context (?:length|window)|maximum context|too many tokens|token limit|input is too long/i.test(
      text,
    ) ||
    /\bmodel (?:is )?unavailable\b|invalid image|bad image|unsupported image (?:type|format|mime|media)|image.{0,30}too large|payload too large/i.test(
      text,
    ) ||
    /does not support (?:images?|vision|multimodal)|not (?:a )?(?:multimodal|vision)|only supports text|text.only model|image(?: input)? (?:is )?(?:unsupported|not supported)/i.test(
      text,
    ) ||
    /invalid (?:json[_\s-]*)?schema|schema(?:\s+(?:is|was))?\s+invalid|schema.{0,30}(?:required|additionalProperties)|required.{0,30}schema|unsupported (?:json[_\s-]*)?schema (?:keyword|property)|schema.{0,30}(?:keyword|property|properties|syntax|definition).{0,30}(?:unsupported|not supported|invalid)/i.test(
      text,
    )
  );
}

function isConditionalModeRejection(text: string): boolean {
  const feature =
    '(?:stream(?:ing)?|json\\s*schema|response\\s*format|structured(?:\\s+output)?)';

  return (
    new RegExp(
      `\\b(?:with|without|when|while|during|for|in|if)\\s+(?:(?:using|requesting|sending|enabling|the|a|an)\\s+)*${feature}\\b`,
      'i',
    ).test(text) ||
    new RegExp(
      `\\b${feature}\\b[^.\\n]{0,80}\\b(?:with|without|when|while|during|if)\\b`,
      'i',
    ).test(text)
  );
}
