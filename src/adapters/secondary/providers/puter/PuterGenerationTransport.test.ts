import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test';
import puterSdk from '@heyputer/puter.js';
import type { ChatResponseChunk } from '@heyputer/puter.js';
import { PuterGenerationTransport } from './PuterGenerationTransport';
import { createGenerationResponseSchema } from '../../translation/output/translation-schema';
import { VALID_IMAGE } from '../../../../../tests/test-fixtures';
import type {
  GenerationEvent,
  GenerationRequest,
} from '../../translation/transports/GenerationTransport';
import { ErrorCode } from '../../../../shared/errors';

function request(mode: 'plain-stream' | 'plain-buffered'): GenerationRequest {
  return {
    mode,
    image: VALID_IMAGE,
    instructions: 'JSON prompt',
    userText: 'Read screenshot',
    schema: createGenerationResponseSchema(),
    signal: new AbortController().signal,
  };
}

async function* chunks(parts: ChatResponseChunk[]) {
  yield* parts;
}

const chat = spyOn(puterSdk.ai, 'chat');

const setToken = spyOn(puterSdk, 'setAuthToken').mockImplementation((token) => {
  puterSdk.authToken = token;
});

const callAt = (index: number) =>
  chat.mock.calls[index] as unknown as [
    string,
    string,
    Record<string, unknown>,
  ];

afterEach(() => {
  chat.mockReset();
  setToken.mockClear();
});

afterAll(() => {
  chat.mockRestore();
  setToken.mockRestore();
});

describe('Adapter: PuterGenerationTransport', () => {
  test('decodes the installed typed text chunks and ignores reasoning/tool/usage objects', async () => {
    const parts: ChatResponseChunk[] = [
      { type: 'reasoning', reasoning: 'hidden' },
      { type: 'text', text: '{"hello":' },
      { type: 'tool_use', name: 'unused', input: {} },
      { type: 'text', text: '"world"}' },
      { type: 'usage', usage: { output_tokens: 5 } },
    ];

    chat.mockResolvedValueOnce(chunks(parts) as never);

    const events: GenerationEvent[] = [];

    const result = await new PuterGenerationTransport(
      'token-fixture',
      'native-model',
    ).generate(request('plain-stream'), async (event) => {
      events.push(event);
    });

    expect(result.text).toBe('{"hello":"world"}');

    expect(events).toEqual([
      { type: 'text', text: '{"hello":' },
      { type: 'text', text: '"world"}' },
    ]);

    expect(callAt(0)).toEqual([
      'JSON prompt\n\nRead screenshot',
      VALID_IMAGE.value,
      { model: 'native-model', temperature: 0, stream: true },
    ]);

    expect(puterSdk.authToken).toBe('token-fixture');
  });

  test('propagates typed unsupported-stream errors to the shared compatibility policy', async () => {
    chat.mockResolvedValueOnce(
      chunks([
        { type: 'error', message: 'Streaming is not supported for this model' },
      ]) as never,
    );

    await expect(
      new PuterGenerationTransport('token-fixture', 'native-model').generate(
        request('plain-stream'),
        async () => {},
      ),
    ).rejects.toMatchObject({
      type: 'error',
      message: 'Streaming is not supported for this model',
    });
  });

  test('preserves a native control/stream conflict for pair-specific compatibility', async () => {
    const error = {
      status: 400,
      code: 'invalid_request_error',
      message: 'reasoning_effort cannot be used in streaming',
    };

    chat.mockRejectedValueOnce(error);

    await expect(
      new PuterGenerationTransport('token-fixture', 'gpt-5.2').generate(
        request('plain-stream'),
        async () => {},
      ),
    ).rejects.toBe(error);
  });

  test.each([
    [
      'Unsupported image input format: image/bmp',
      ErrorCode.TRANSLATION_INVALID_IMAGE,
    ],
    [
      'Image input is unsupported because its dimensions exceed the limit',
      ErrorCode.TRANSLATION_IMAGE_TOO_LARGE,
    ],
  ])('native image rejection stays terminal: %s', async (message, code) => {
    chat.mockRejectedValueOnce({
      status: 400,
      error: { code: 'invalid_request_error', message },
    });

    await expect(
      new PuterGenerationTransport('token-fixture', 'native-model').generate(
        request('plain-stream'),
        async () => {},
      ),
    ).rejects.toMatchObject({ code });

    expect(chat).toHaveBeenCalledTimes(1);
  });

  test('extracts normalized buffered text parts while preserving image and repair prompt', async () => {
    chat.mockResolvedValueOnce({
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'part one' },
          { type: 'text', text: 'part two' },
        ],
      },
      finish_reason: 'end_turn',
    } as never);

    const input = request('plain-buffered');

    input.userText =
      '<untrusted_previous_response>bad</untrusted_previous_response>';

    const result = await new PuterGenerationTransport(
      'token-fixture',
      'native-model',
    ).generate(input, async () => {});

    expect(result.text).toBe('part onepart two');
    expect(result.finishReason).toBe('stop');
    expect(callAt(0)[0]).toContain(input.userText);
    expect(callAt(0)[1]).toBe(VALID_IMAGE.value);

    expect(callAt(0)[2]).toEqual({
      model: 'native-model',
      temperature: 0,
      normalize: true,
    });
  });

  test.each(['plain-stream', 'plain-buffered'] as const)(
    '%s requests the minimum for Puter models that reject none',
    async (mode) => {
      if (mode === 'plain-stream')
        chat.mockResolvedValueOnce(chunks([]) as never);
      else
        chat.mockResolvedValueOnce({
          message: { role: 'assistant', content: '{}' },
        } as never);

      await new PuterGenerationTransport(
        'token-fixture',
        'gemini-3.1-flash-lite',
      ).generate(request(mode), async () => {});

      expect(callAt(0)[2].reasoning_effort).toBe('minimal');
    },
  );

  test('normalizes blocked completion without inviting JSON repair', async () => {
    chat.mockResolvedValueOnce({
      message: { role: 'assistant', content: '' },
      finish_reason: 'content_filter',
    } as never);

    const result = await new PuterGenerationTransport(
      'token-fixture',
      'native-model',
    ).generate(request('plain-buffered'), async () => {});

    expect(result.finishReason).toBe('content-filter');
  });

  test('a normalized native refusal remains blocked even when finish reason is stop', async () => {
    chat.mockResolvedValueOnce({
      message: {
        role: 'assistant',
        content: '{}',
        refusal: 'This request cannot be completed.',
      },
      finish_reason: 'stop',
    } as never);

    await expect(
      new PuterGenerationTransport('token-fixture', 'native-model').generate(
        request('plain-buffered'),
        async () => {},
      ),
    ).rejects.toMatchObject({ code: ErrorCode.TRANSLATION_CONTENT_BLOCKED });

    expect(chat).toHaveBeenCalledTimes(1);
  });

  test('empty native refusal metadata does not reject a completed response', async () => {
    chat.mockResolvedValueOnce({
      message: { role: 'assistant', content: '{}', refusal: null },
      finish_reason: 'stop',
    } as never);

    const result = await new PuterGenerationTransport(
      'token-fixture',
      'native-model',
    ).generate(request('plain-buffered'), async () => {});

    expect(result).toMatchObject({ text: '{}', finishReason: 'stop' });
  });

  test('authentication and usage errors remain terminal application errors', async () => {
    chat.mockRejectedValueOnce({
      code: 'usage_limited',
      message: 'Usage limit exceeded',
    });

    await expect(
      new PuterGenerationTransport('token-fixture', 'native-model').generate(
        request('plain-buffered'),
        async () => {},
      ),
    ).rejects.toMatchObject({
      code: ErrorCode.TRANSLATION_PROVIDER_QUOTA_EXCEEDED,
    });
  });
});
