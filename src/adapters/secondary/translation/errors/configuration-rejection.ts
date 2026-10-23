interface ConfigurationRejectionDetails {
  text: string;
  parameters: readonly string[];
  sdkUnsupported: boolean;
}

/** Match active-control attribution only after classification permits evidence. */
export function matchConfigurationRejection(
  { text, parameters, sdkUnsupported }: ConfigurationRejectionDetails,
  fields: readonly string[],
): 'configuration' | 'configuration-mode' | null {
  if (!fields.length) return null;

  const activeFields = fields
    .map(fieldPattern)
    .filter((pattern): pattern is RegExp => pattern !== null);

  const modeConflict = isConditionalModeRejection(text);

  if (
    parameters.length &&
    !parameters.some((name) => namesActiveField(name, activeFields))
  ) {
    // A stream/schema parameter can attribute a conditional conflict only when
    // the message explicitly identifies the active control as well.
    if (
      !modeConflict ||
      !parameters.some(isModeParameter) ||
      !namesActiveField(text, activeFields)
    )
      return null;
  }

  if (!parameters.length && !namesActiveField(text, activeFields)) return null;
  if (!sdkUnsupported && !explicitlyRejectsConfiguration(text)) return null;

  return modeConflict ? 'configuration-mode' : 'configuration';
}

function namesActiveField(text: string, fields: readonly RegExp[]): boolean {
  return fields.some((field) => field.test(text));
}

function isModeParameter(name: string): boolean {
  return /(?:^|[.[])(?:stream|response[_-]?format|json[_-]?schema)(?=$|[.\]])/i.test(
    name,
  );
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
    /\b(?:only\s+(?:supports?|supported|allows?)|must\s+(?:not\s+)?(?:be|equal|have|enable|include)|input should be|(?:is|are)\s+(?:required|mandatory)|cannot\s+(?:be\s+)?(?:disable(?:d)?|used|combined))\b/i.test(
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
