import { beforeEach, describe, expect, test } from 'bun:test';
import { NoObjectGeneratedError } from 'ai';
import type { LanguageModel } from 'ai';
import {
  generateTextMock,
  resetStreamTextMock,
  streamTextMock,
} from '../../../../../../tests/browser-mock';
import {
  VALID_IMAGE,
  VALID_PAIRED_TRANSLATION_RESPONSE,
} from '../../../../../../tests/test-fixtures';
import { AiSdkGenerationTransport } from './AiSdkGenerationTransport';
import { createGenerationResponseSchema } from '../../output/translation-schema';
import type { GenerationRequest } from '../GenerationTransport';
import type { GenerationMode } from '../generation-modes';

const model = { provider: 'fixture', modelId: 'vision-model' } as LanguageModel;

function request(mode: GenerationMode): GenerationRequest {
  return {
    mode,
    image: VALID_IMAGE,
    instructions: 'JSON instructions',
    userText: 'Read image',
    schema: createGenerationResponseSchema(),
    signal: new AbortController().signal,
  };
}

describe('Adapter: AiSdkGenerationTransport', () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    resetStreamTextMock();

    generateTextMock.mockResolvedValue({
      text: JSON.stringify(VALID_PAIRED_TRANSLATION_RESPONSE),
      output: VALID_PAIRED_TRANSLATION_RESPONSE,
      finishReason: 'stop',
    });
  });

  test.each([
    'structured-stream',
    'plain-stream',
    'structured-buffered',
    'plain-buffered',
  ] as const)(
    '%s preserves image/instructions and disables hidden SDK retries',
    async (mode) => {
      const input = request(mode);

      const result = await new AiSdkGenerationTransport(model).generate(
        input,
        async () => {},
      );

      expect(result.finishReason).toBe('stop');

      const options = generateTextMock.mock.calls[0][0] as {
        instructions: string;
        maxRetries: number;
        telemetry: { isEnabled: boolean };
        temperature: number;
        reasoning: string;
        abortSignal: AbortSignal;
        output?: unknown;
        messages: { role: string; content: unknown[] }[];
      };

      expect(options.instructions).toBe(input.instructions);
      expect(options.maxRetries).toBe(0);
      expect(options.telemetry).toEqual({ isEnabled: false });
      expect(options.temperature).toBe(0);
      expect(options.reasoning).toBeUndefined();
      expect(options.abortSignal.aborted).toBe(false);
      expect(Boolean(options.output)).toBe(mode.startsWith('structured'));

      expect(options.messages).toEqual([
        {
          role: 'user',
          content: [
            { type: 'text', text: input.userText },
            {
              type: 'file',
              data: { type: 'data', data: VALID_IMAGE.base64Data },
              mediaType: VALID_IMAGE.mimeType,
            },
          ],
        },
      ]);

      expect(streamTextMock.mock.calls.length).toBe(
        mode.endsWith('stream') ? 1 : 0,
      );
    },
  );

  test.each([
    'structured-stream',
    'plain-stream',
    'structured-buffered',
    'plain-buffered',
  ] as const)(
    '%s retains common thinking controls while scoping structured options',
    async (mode) => {
      const transport = new AiSdkGenerationTransport(model, {
        configurations: [
          {
            id: 'test.native-off.v1',
            intent: 'disabled',
            rejectionFields: ['thinking'],
            reasoning: 'none',
            providerOptions: { anthropic: { thinking: { type: 'disabled' } } },
          },
        ],
        structuredProviderOptions: {
          anthropic: { structuredOutputMode: 'outputFormat' },
        },
      });

      await transport.generate(request(mode), async () => {});

      const options = generateTextMock.mock.calls[0][0] as {
        providerOptions: unknown;
      };

      expect(generateTextMock.mock.calls[0][0]).toMatchObject({
        reasoning: 'none',
      });

      expect(options.providerOptions).toEqual({
        anthropic: {
          thinking: { type: 'disabled' },
          ...(mode.startsWith('structured')
            ? { structuredOutputMode: 'outputFormat' }
            : {}),
        },
      });
    },
  );

  test('buffered schema rejection retains raw output for shared validation and repair', async () => {
    const rejection = new NoObjectGeneratedError({
      text: 'bad JSON',
      finishReason: 'stop',
      response: { id: 'fixture', timestamp: new Date(), modelId: 'fixture' },
      usage: {} as never,
    });

    generateTextMock.mockRejectedValue(rejection);

    const result = await new AiSdkGenerationTransport(model).generate(
      request('structured-buffered'),
      async () => {},
    );

    expect(result.text).toBe('bad JSON');
    expect(result.schemaValidated).toBe(false);
    expect(result.validationError).toBe(rejection);
  });

  test('schema rejection without a finish reason does not invent successful termination', async () => {
    const rejection = new NoObjectGeneratedError({
      text: JSON.stringify(VALID_PAIRED_TRANSLATION_RESPONSE),
      finishReason: undefined as never,
      response: { id: 'fixture', timestamp: new Date(), modelId: 'fixture' },
      usage: {} as never,
    });

    generateTextMock.mockRejectedValueOnce(rejection);

    const result = await new AiSdkGenerationTransport(model).generate(
      request('structured-buffered'),
      async () => {},
    );

    expect(result.finishReason).toBe('unknown');
    expect(result.validationError).toBe(rejection);
  });

  test('an already cancelled request never invokes the SDK', async () => {
    const input = request('plain-stream');
    const reason = new Error('closed before generation');

    input.signal = AbortSignal.abort(reason);

    await expect(
      new AiSdkGenerationTransport(model).generate(input, async () => {}),
    ).rejects.toBe(reason);

    expect(generateTextMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  test('buffered cancellation does not wait for an uncooperative native request', async () => {
    let settle!: (value: unknown) => void;

    generateTextMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );

    const controller = new AbortController();
    const input = request('structured-buffered');

    input.signal = controller.signal;

    const pending = new AiSdkGenerationTransport(model).generate(
      input,
      async () => {},
    );

    const reason = new Error('cancel buffered request');

    controller.abort(reason);

    try {
      await expect(pending).rejects.toBe(reason);
    } finally {
      settle({
        text: '{}',
        output: {},
        finishReason: 'stop',
      });
    }
  });

  test('a falsy in-band error is not ignored when a later finish reports stop', async () => {
    streamTextMock.mockReturnValueOnce({
      stream: (async function* () {
        yield { type: 'text-delta', text: '{}' };
        yield { type: 'error', error: null };
      })(),
      finishReason: Promise.resolve('stop'),
    } as never);

    await expect(
      new AiSdkGenerationTransport(model).generate(
        request('plain-stream'),
        async () => {},
      ),
    ).rejects.toBeNull();
  });

  test('cancellation covers final validation after both stream branches have ended', async () => {
    let finishPump!: () => void;

    const pumped = new Promise<void>((resolve) => {
      finishPump = resolve;
    });

    let settleOutput!: (value: unknown) => void;

    const output = new Promise((resolve) => {
      settleOutput = resolve;
    });

    streamTextMock.mockReturnValueOnce({
      stream: (async function* () {
        yield { type: 'text-delta', text: '{}' };
        finishPump();
      })(),
      partialOutputStream: (async function* () {})(),
      finishReason: Promise.resolve('stop'),
      output,
    } as never);

    const controller = new AbortController();
    const input = request('structured-stream');

    input.signal = controller.signal;

    const pending = new AiSdkGenerationTransport(model).generate(
      input,
      async () => {},
    );

    await pumped;
    await new Promise((resolve) => setTimeout(resolve, 0));

    const reason = new Error('cancel final validation');

    controller.abort(reason);

    try {
      await expect(pending).rejects.toBe(reason);
    } finally {
      settleOutput({});
    }
  });

  test('observer rejection stops native stream and propagates the original failure', async () => {
    const reason = new Error('display receiver closed');
    const input = request('structured-stream');

    await expect(
      new AiSdkGenerationTransport(model).generate(input, async () => {
        throw reason;
      }),
    ).rejects.toBe(reason);

    const options = streamTextMock.mock.calls[0][0] as {
      abortSignal: AbortSignal;
    };

    expect(options.abortSignal.aborted).toBe(true);
  });
});
