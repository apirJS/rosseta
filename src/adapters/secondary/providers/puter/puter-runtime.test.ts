import { createTranslationAdapter } from '../../../../../tests/create-translation-service';
import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test';
import puterSdk from '@heyputer/puter.js';
import type { ChatResponseChunk } from '@heyputer/puter.js';

import { ApiKey } from '../../../../core/domain/credential/ApiKey';
import { Credential } from '../../../../core/domain/credential/Credential';
import { UserPreferences } from '../../../../core/domain/preferences/UserPreferences';
import type { TranslationProgress } from '../../../../core/ports/outbound/TranslationExecutionOptions';
import { FakeTranslationCapabilityStorage } from '../../../../../tests/fakes/FakeTranslationCapabilityStorage';
import {
  TARGET_LANGUAGE,
  VALID_IMAGE,
  VALID_PAIRED_TRANSLATION_RESPONSE,
} from '../../../../../tests/test-fixtures';
import { AbortCancellationToken } from '../../../primary/background/translation/AbortCancellationToken';
import { success } from '../../../../shared/types/Result';
import { ErrorCode } from '../../../../shared/errors';

function adapter(
  storage = new FakeTranslationCapabilityStorage(),
  modelId = 'fixture-native',
) {
  const key = ApiKey.createWithProvider('fixture-token', 'puter');

  if (!key.success) throw key.error;

  const credential = Credential.create(crypto.randomUUID(), key.data, 'puter');

  if (!credential.success) throw credential.error;

  return createTranslationAdapter(
    credential.data,
    UserPreferences.createDefault(crypto.randomUUID()).withSelectedModel(
      'puter',
      modelId,
    ),
    undefined,
    storage,
  );
}

const raw = JSON.stringify(VALID_PAIRED_TRANSLATION_RESPONSE);

const buffered = {
  message: { role: 'assistant', content: raw },
  finish_reason: 'stop',
};

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

afterEach(() => chat.mockReset());

afterAll(() => {
  chat.mockRestore();
  setToken.mockRestore();
});

describe('Adapter: PuterTranslationAdapter', () => {
  test('streams partial native text through the same generic observer and validates the final domain result', async () => {
    const progress: TranslationProgress[] = [];
    const split = raw.indexOf('Hello') + 2;

    chat.mockResolvedValueOnce(
      chunks([
        { type: 'text', text: raw.slice(0, split) },
        { type: 'text', text: raw.slice(split) },
      ]) as never,
    );

    const result = await adapter().translateImage(
      VALID_IMAGE,
      TARGET_LANGUAGE,
      {
        progress: {
          report: async (event) => {
            progress.push(event);

            return success(undefined);
          },
        },
      },
    );

    expect(result.success).toBe(true);
    expect(progress[0].kind).toBe('reset');

    expect(
      progress.some(
        (event) =>
          event.kind === 'snapshot' &&
          event.draft.segments[0]?.translatedText === 'He',
      ),
    ).toBe(true);

    expect(chat.mock.calls[0][2]).toMatchObject({
      model: 'fixture-native',
      stream: true,
    });
  });

  test('unsupported stream downgrades to complete buffered output and later requests directly reuse it', async () => {
    chat.mockResolvedValueOnce(
      chunks([
        { type: 'error', message: 'Streaming is not supported for this model' },
      ]) as never,
    );

    chat.mockResolvedValueOnce(buffered as never);
    chat.mockResolvedValueOnce(buffered as never);

    const service = adapter();

    expect(
      (await service.translateImage(VALID_IMAGE, TARGET_LANGUAGE)).success,
    ).toBe(true);

    expect(
      (await service.translateImage(VALID_IMAGE, TARGET_LANGUAGE)).success,
    ).toBe(true);

    expect(chat.mock.calls.map((_, index) => callAt(index)[2])).toEqual([
      { model: 'fixture-native', temperature: 0, stream: true },
      { model: 'fixture-native', temperature: 0, normalize: true },
      { model: 'fixture-native', temperature: 0, normalize: true },
    ]);
  });

  test('a rejected native thinking control falls back to minimum effort and directly reuses the cached profile', async () => {
    chat.mockRejectedValueOnce({
      status: 400,
      error: {
        code: 'invalid_request_error',
        message: "Unsupported value: 'none'",
        param: 'reasoning_effort',
      },
    });

    chat.mockResolvedValueOnce(chunks([{ type: 'text', text: raw }]) as never);
    chat.mockResolvedValueOnce(chunks([{ type: 'text', text: raw }]) as never);

    const storage = new FakeTranslationCapabilityStorage();
    const service = adapter(storage, 'gpt-5.2');

    expect(
      (await service.translateImage(VALID_IMAGE, TARGET_LANGUAGE)).success,
    ).toBe(true);

    expect(
      (await service.translateImage(VALID_IMAGE, TARGET_LANGUAGE)).success,
    ).toBe(true);

    expect(
      chat.mock.calls.map((_, index) => callAt(index)[2].reasoning_effort),
    ).toEqual(['none', 'low', 'low']);

    expect(
      chat.mock.calls.every((_, index) => callAt(index)[2].stream === true),
    ).toBe(true);

    const facts = [...storage.records.values()][0].facts;

    expect(facts['configuration.thinking.puter.none.v1'].support).toBe(
      'unsupported',
    );

    expect(facts['configuration.thinking.puter.low.v1'].support).toBe(
      'supported',
    );

    expect(facts['feature.stream'].support).toBe('supported');
  });

  test('typed in-band native control errors fall back through minimum to omission and cache that selection', async () => {
    const error = {
      type: 'error',
      code: 'invalid_request_error',
      message: 'reasoning_effort is unsupported',
    };

    chat.mockResolvedValueOnce(chunks([error]) as never);
    chat.mockResolvedValueOnce(chunks([error]) as never);
    chat.mockResolvedValueOnce(chunks([{ type: 'text', text: raw }]) as never);
    chat.mockResolvedValueOnce(chunks([{ type: 'text', text: raw }]) as never);

    const storage = new FakeTranslationCapabilityStorage();
    const service = adapter(storage, 'gpt-5.2');

    expect(
      (await service.translateImage(VALID_IMAGE, TARGET_LANGUAGE)).success,
    ).toBe(true);

    expect(
      (await service.translateImage(VALID_IMAGE, TARGET_LANGUAGE)).success,
    ).toBe(true);

    expect(
      chat.mock.calls.map((_, index) => callAt(index)[2].reasoning_effort),
    ).toEqual(['none', 'low', undefined, undefined]);

    const facts = [...storage.records.values()][0].facts;

    expect(facts['configuration.thinking.puter.none.v1'].support).toBe(
      'unsupported',
    );

    expect(facts['configuration.thinking.puter.low.v1'].support).toBe(
      'unsupported',
    );

    expect(facts['configuration.thinking.provider-default.v1'].support).toBe(
      'supported',
    );
  });

  test('preserves native failed-envelope thinking metadata when the Puter SDK omits HTTP status', async () => {
    chat.mockRejectedValueOnce({
      success: false,
      error: {
        code: 'invalid_request_error',
        message: "Unsupported value: 'none'",
        param: 'reasoning_effort',
      },
    });

    chat.mockResolvedValueOnce(chunks([{ type: 'text', text: raw }]) as never);
    chat.mockResolvedValueOnce(chunks([{ type: 'text', text: raw }]) as never);

    const service = adapter(new FakeTranslationCapabilityStorage(), 'gpt-5.2');

    expect(
      (await service.translateImage(VALID_IMAGE, TARGET_LANGUAGE)).success,
    ).toBe(true);

    expect(
      (await service.translateImage(VALID_IMAGE, TARGET_LANGUAGE)).success,
    ).toBe(true);

    expect(
      chat.mock.calls.map((_, index) => callAt(index)[2].reasoning_effort),
    ).toEqual(['none', 'low', 'low']);
  });

  test('Puter usage-limit metadata cannot become a thinking incompatibility fact', async () => {
    chat.mockRejectedValueOnce({
      status: 400,
      metadata: { usage_limited: true },
      error: {
        code: 'invalid_request_error',
        message: "Unsupported value: 'none'",
        param: 'reasoning_effort',
      },
    });

    const storage = new FakeTranslationCapabilityStorage();

    const result = await adapter(storage, 'gpt-5.2').translateImage(
      VALID_IMAGE,
      TARGET_LANGUAGE,
    );

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(
        ErrorCode.TRANSLATION_PROVIDER_QUOTA_EXCEEDED,
      );
    expect(chat.mock.calls).toHaveLength(1);

    expect(
      [...storage.records.values()][0].facts[
        'configuration.thinking.puter.none.v1'
      ].support,
    ).toBe('unknown');
  });

  test('malformed completion has one buffered repair preserving original image and paired schema prompt', async () => {
    chat.mockResolvedValueOnce(
      chunks([{ type: 'text', text: 'bad JSON' }]) as never,
    );

    chat.mockResolvedValueOnce(buffered as never);

    expect(
      (await adapter().translateImage(VALID_IMAGE, TARGET_LANGUAGE)).success,
    ).toBe(true);

    expect(chat.mock.calls).toHaveLength(2);
    expect(callAt(1)[0]).toContain('untrusted_previous_response');
    expect(callAt(1)[0]).toContain('originalLanguageBcp47Code');
    expect(callAt(1)[1]).toBe(VALID_IMAGE.value);
    expect(callAt(1)[2]).toMatchObject({ normalize: true });
  });

  test('auth errors do not discover another mode or poison compatibility state', async () => {
    chat.mockRejectedValueOnce({
      status: 401,
      code: 'invalid_token',
      message: 'Invalid token',
    });

    const storage = new FakeTranslationCapabilityStorage();

    const result = await adapter(storage).translateImage(
      VALID_IMAGE,
      TARGET_LANGUAGE,
    );

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
    expect(chat.mock.calls).toHaveLength(1);

    expect(
      [...storage.records.values()][0].facts['feature.stream'].support,
    ).toBe('unknown');
  });

  test('logical cancellation returns promptly during blocked next and ignores late text/completion', async () => {
    let started!: () => void;
    let finish!: () => void;

    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });

    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });

    async function* pendingStream() {
      started();
      await gate;
      yield { type: 'text', text: raw };
    }

    chat.mockResolvedValueOnce(pendingStream() as never);

    const token = new AbortCancellationToken();
    const progress: TranslationProgress[] = [];
    const storage = new FakeTranslationCapabilityStorage();

    const pending = adapter(storage).translateImage(
      VALID_IMAGE,
      TARGET_LANGUAGE,
      {
        cancellationToken: token,
        progress: {
          report: async (event) => {
            progress.push(event);

            return success(undefined);
          },
        },
      },
    );

    await entered;
    token.cancel();

    const result = await pending;

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_CANCELLED);
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(progress.map((event) => event.kind)).toEqual(['reset']);

    expect(
      [...storage.records.values()][0].facts['feature.image'].support,
    ).toBe('unknown');

    expect(chat.mock.calls).toHaveLength(1);
  });
});
