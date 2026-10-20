export interface GenerationErrorDetails {
  status: number;
  message: string;
  code: string;
  parameters: string[];
  url?: string;
}

const MAX_ERROR_ENVELOPES = 16;
const MAX_ERROR_TEXT_LENGTH = 65_536;
const PROVIDER_ERROR_FIELDS = ['error', 'data', 'responseBody'] as const;

/** Read known SDK/provider envelopes without inspecting requests or metadata. */
export function readGenerationErrorDetails(
  error: unknown,
): GenerationErrorDetails {
  const messages = new Set<string>();
  const codes = new Set<string>();
  const parameters = new Set<string>();
  const seen = new Set<object>();
  const queue: unknown[] = [error];
  let status = 0;
  let url: string | undefined;

  for (
    let index = 0;
    index < queue.length && index < MAX_ERROR_ENVELOPES;
    index++
  ) {
    const decoded = decodeEnvelope(queue[index]);

    if (typeof decoded === 'string') {
      messages.add(decoded);

      continue;
    }

    if (
      !decoded ||
      typeof decoded !== 'object' ||
      Array.isArray(decoded) ||
      seen.has(decoded)
    )
      continue;

    seen.add(decoded);

    const record = decoded as Record<string, unknown>;

    status ||= readStatus(record);

    if (!url && typeof record.url === 'string') url = record.url;
    if (typeof record.message === 'string' && record.message.trim())
      messages.add(record.message);
    if (typeof record.code === 'string') codes.add(record.code.toLowerCase());
    if (typeof record.type === 'string') codes.add(record.type.toLowerCase());

    for (const key of ['param', 'parameter']) {
      if (typeof record[key] === 'string' && record[key].trim())
        parameters.add(record[key]);
    }

    for (const key of PROVIDER_ERROR_FIELDS) {
      if (record[key] !== undefined && record[key] !== null)
        queue.push(record[key]);
    }
  }

  return {
    status,
    message: [...messages].join('\n') || String(error),
    code: [...codes].join('\n'),
    parameters: [...parameters],
    url,
  };
}

function decodeEnvelope(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const text = value.slice(0, MAX_ERROR_TEXT_LENGTH);

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readStatus(record: Record<string, unknown>): number {
  for (const candidate of [record.statusCode, record.status]) {
    const status = Number(candidate);

    if (Number.isFinite(status) && status > 0) return status;
  }

  return 0;
}
