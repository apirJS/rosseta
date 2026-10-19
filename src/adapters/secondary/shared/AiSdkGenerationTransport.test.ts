import { beforeEach, describe, expect, test } from 'bun:test';
import { NoObjectGeneratedError } from 'ai';
import type { LanguageModel } from 'ai';
import { generateTextMock, resetStreamTextMock, streamTextMock } from '../../../../tests/browser-mock';
import { VALID_IMAGE, VALID_PAIRED_TRANSLATION_RESPONSE } from '../../../../tests/test-fixtures';
import { AiSdkGenerationTransport } from './AiSdkGenerationTransport';
import { createTranslationDataSchema } from './translation-schema';
import type { GenerationMode, GenerationRequest } from './ITranslationGenerationTransport';

const model = { provider: 'fixture', modelId: 'vision-model' } as LanguageModel;
function request(mode: GenerationMode): GenerationRequest {
  return { mode, image: VALID_IMAGE, instructions: 'JSON instructions', userText: 'Read image', schema: createTranslationDataSchema(), signal: new AbortController().signal };
}

describe('Adapter: AiSdkGenerationTransport', () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    resetStreamTextMock();
    generateTextMock.mockResolvedValue({ text: JSON.stringify(VALID_PAIRED_TRANSLATION_RESPONSE), output: VALID_PAIRED_TRANSLATION_RESPONSE, finishReason: 'stop' });
  });

  test.each(['structured-stream', 'plain-stream', 'structured-buffered', 'plain-buffered'] as const)('%s preserves image/instructions and disables hidden SDK retries', async mode => {
    const input = request(mode);
    const result = await new AiSdkGenerationTransport(model).generate(input, async () => {});
    expect(result.finishReason).toBe('stop');
    const options = generateTextMock.mock.calls[0][0] as { instructions: string; maxRetries: number; temperature: number; abortSignal: AbortSignal; output?: unknown; messages: { role: string; content: unknown[] }[] };
    expect(options.instructions).toBe(input.instructions);
    expect(options.maxRetries).toBe(0);
    expect(options.temperature).toBe(0);
    expect(options.abortSignal.aborted).toBe(false);
    expect(Boolean(options.output)).toBe(mode.startsWith('structured'));
    expect(options.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: input.userText }, { type: 'file', data: { type: 'data', data: VALID_IMAGE.base64Data }, mediaType: VALID_IMAGE.mimeType }] }]);
    expect(streamTextMock.mock.calls.length).toBe(mode.endsWith('stream') ? 1 : 0);
  });

  test('buffered schema rejection retains raw output for shared validation and repair', async () => {
    const rejection = new NoObjectGeneratedError({ text: 'bad JSON', finishReason: 'stop', response: { id: 'fixture', timestamp: new Date(), modelId: 'fixture' }, usage: {} as never });
    generateTextMock.mockRejectedValue(rejection);
    const result = await new AiSdkGenerationTransport(model).generate(request('structured-buffered'), async () => {});
    expect(result.text).toBe('bad JSON');
    expect(result.schemaValidated).toBe(false);
    expect(result.validationError).toBe(rejection);
  });

  test('observer rejection stops native stream and propagates the original failure', async () => {
    const reason = new Error('display receiver closed');
    const input = request('structured-stream');
    await expect(new AiSdkGenerationTransport(model).generate(input, async () => { throw reason; })).rejects.toBe(reason);
    const options = streamTextMock.mock.calls[0][0] as { abortSignal: AbortSignal };
    expect(options.abortSignal.aborted).toBe(true);
  });
});
