/* eslint-disable no-await-in-loop -- Fixture stream chunks are intentionally paced and ordered. */
/** Deterministic, credential-free OpenAI/Anthropic fixture. Run with Bun; import its handler in SDK tests. */
import { UNAVAILABLE_RESPONSE_FORMAT_ERROR } from './captured-provider-errors';
type Protocol = 'openai' | 'anthropic';
type JsonRecord = Record<string, unknown>;
export interface FixtureRequest {
  protocol: Protocol;
  scenario: string;
  model: string;
  streamed: boolean;
  structured: boolean;
  repair: boolean;
  routingHeaderPresent: boolean;
  routingQueryPresent: boolean;
}

function object(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Cache-Control': 'no-store',
};

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: cors });
}

function unsupported(protocol: Protocol, message: string): Response {
  return json(
    protocol === 'anthropic'
      ? { type: 'error', error: { type: 'invalid_request_error', message } }
      : {
          error: {
            type: 'invalid_request_error',
            code: 'unsupported_feature',
            message,
          },
        },
    400,
  );
}

function paired(includeDescription: boolean) {
  return {
    success: true,
    error: null,
    data: {
      segments: [
        {
          blockIndex: 0,
          originalText: '\u3053\u3093\u306b\u3061\u306f',
          translatedText: 'Hello',
          originalLanguageBcp47Code: 'ja-JP',
          romanization: 'konnichiwa',
        },
        {
          blockIndex: 1,
          originalText: '\u0e44\u0e17\u0e22',
          translatedText: 'Thai',
          originalLanguageBcp47Code: 'th-TH',
          romanization: 'thai',
        },
      ],
      ...(includeDescription
        ? { description: 'Two greetings in separate visual blocks.' }
        : {}),
    },
  };
}

function buffered(protocol: Protocol, model: string, text: string): Response {
  return json(
    protocol === 'anthropic'
      ? {
          id: 'msg-fixture',
          type: 'message',
          role: 'assistant',
          model,
          content: [{ type: 'text', text }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }
      : {
          id: 'chatcmpl-fixture',
          object: 'chat.completion',
          created: 1,
          model,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: text },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
  );
}

function streaming(
  protocol: Protocol,
  model: string,
  text: string,
  scenario: string,
  delayMs: number,
): Response {
  const encoder = new TextEncoder();
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, value: unknown) => {
        if (!cancelled)
          controller.enqueue(
            encoder.encode(
              `${protocol === 'anthropic' ? `event: ${event}\n` : ''}data: ${JSON.stringify(value)}\n\n`,
            ),
          );
      };
      try {
        if (protocol === 'anthropic') {
          send('message_start', {
            type: 'message_start',
            message: {
              id: 'msg-fixture',
              type: 'message',
              role: 'assistant',
              model,
              content: [],
              stop_reason: null,
              usage: { input_tokens: 1, output_tokens: 0 },
            },
          });
          send('content_block_start', {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'text', text: '' },
          });
        }
        for (let index = 0; index < text.length; index += 12) {
          if (cancelled) return;
          if (delayMs > 0)
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          const chunk = text.slice(index, index + 12);
          send(
            'content_block_delta',
            protocol === 'anthropic'
              ? {
                  type: 'content_block_delta',
                  index: 0,
                  delta: { type: 'text_delta', text: chunk },
                }
              : {
                  id: 'chatcmpl-fixture',
                  object: 'chat.completion.chunk',
                  created: 1,
                  model,
                  choices: [
                    {
                      index: 0,
                      delta: { content: chunk },
                      finish_reason: null,
                    },
                  ],
                },
          );
          if (
            (scenario === 'in-band-error' || scenario === 'interruption') &&
            index > text.length / 2
          ) {
            if (scenario === 'interruption') {
              controller.error(new TypeError('network interrupted by fixture'));
              return;
            }
            send(
              'error',
              protocol === 'anthropic'
                ? {
                    type: 'error',
                    error: {
                      type: 'overloaded_error',
                      message: 'network connection interrupted by fixture',
                    },
                  }
                : {
                    error: {
                      type: 'server_error',
                      code: 'server_error',
                      message: 'network connection interrupted by fixture',
                    },
                  },
            );
            controller.close();
            return;
          }
        }
        if (cancelled) return;
        if (protocol === 'anthropic') {
          send('content_block_stop', { type: 'content_block_stop', index: 0 });
          send('message_delta', {
            type: 'message_delta',
            delta: { stop_reason: 'end_turn', stop_sequence: null },
            usage: { output_tokens: 1 },
          });
          send('message_stop', { type: 'message_stop' });
        } else {
          send('finish', {
            id: 'chatcmpl-fixture',
            object: 'chat.completion.chunk',
            created: 1,
            model,
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        }
        controller.close();
      } catch (error) {
        if (!cancelled) controller.error(error);
      }
    },
    cancel() {
      cancelled = true;
    },
  });
  return new Response(body, {
    headers: { ...cors, 'Content-Type': 'text/event-stream' },
  });
}

export function createTranslationFixture(options: { delayMs?: number } = {}) {
  const requests: FixtureRequest[] = [];
  return {
    requests,
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      if (request.method === 'OPTIONS')
        return new Response(null, {
          status: 204,
          headers: {
            ...cors,
            'Access-Control-Allow-Headers':
              request.headers.get('access-control-request-headers') ?? '*',
          },
        });
      if (url.pathname === '/__requests') return json(requests);
      if (url.pathname === '/__reset' && request.method === 'POST') {
        requests.length = 0;
        return json({ success: true });
      }
      const match =
        /^\/(openai|anthropic)\/([a-z-]+)\/v1\/(models|chat\/completions|messages)$/.exec(
          url.pathname,
        );
      if (!match)
        return json(
          {
            error:
              'Use /openai/<scenario>/v1 or /anthropic/<scenario>/v1 as base URL.',
          },
          404,
        );
      const protocol = match[1] as Protocol;
      const scenario = match[2];
      if (match[3] === 'models')
        return json({
          data: [
            {
              id: 'fixture-vision',
              object: 'model',
              type: 'model',
              display_name: 'Fixture Vision',
            },
          ],
          has_more: false,
          first_id: 'fixture-vision',
          last_id: 'fixture-vision',
        });
      let body: JsonRecord;
      try {
        body = object(await request.json());
      } catch {
        return json({ error: 'Invalid JSON request' }, 400);
      }
      const serialized = JSON.stringify(body);
      const streamed = body.stream === true;
      const structured =
        object(body.response_format).type === 'json_schema' ||
        object(object(body.output_config).format).type === 'json_schema';
      const repair = serialized.includes('untrusted_previous_response');
      const model =
        typeof body.model === 'string' ? body.model : 'fixture-vision';
      // Never retain headers, credentials, images or generated request text.
      requests.push({
        protocol,
        scenario,
        model,
        streamed,
        structured,
        repair,
        routingHeaderPresent: request.headers.has('x-fixture-route'),
        routingQueryPresent: url.searchParams.has('fixture-route'),
      });
      if (scenario === 'no-vision')
        return unsupported(protocol, 'This model does not support image input');
      if (scenario === 'unavailable-response-format' && structured)
        return json(UNAVAILABLE_RESPONSE_FORMAT_ERROR, 400);
      if (
        (scenario === 'no-structured' || scenario === 'buffered-only') &&
        structured
      )
        return unsupported(
          protocol,
          'This model does not support response_format json_schema',
        );
      if (
        (scenario === 'no-stream' || scenario === 'buffered-only') &&
        streamed
      )
        return unsupported(
          protocol,
          'Streaming is not supported for this model',
        );
      if (scenario === 'combined-only' && streamed && structured)
        return unsupported(protocol, 'Structured streaming is not supported');
      if (scenario === 'slow-headers')
        await new Promise((resolve) => setTimeout(resolve, 65000));
      const includeDescription = !serialized.includes(
        'Omit the description field entirely.',
      );
      const text =
        scenario === 'no-text'
          ? '{"success":false,"error":"NO_TEXT_FOUND","data":null}'
          : scenario === 'malformed-repair' && !repair
            ? '{"success":true,"data":{"segments":['
            : JSON.stringify(paired(includeDescription));
      return streamed
        ? streaming(
            protocol,
            model,
            text,
            scenario,
            scenario === 'silence' ? 65000 : (options.delayMs ?? 40),
          )
        : buffered(protocol, model, text);
    },
  };
}

if (import.meta.main) {
  const fixture = createTranslationFixture();
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: Number(Bun.env.PORT ?? 8787),
    idleTimeout: 120,
    fetch: (request) => fixture.fetch(request),
  });
  console.info(
    `Translation fixtures ready at ${server.url}. Request metadata: /__requests`,
  );
}
