import { createTranslationAdapter } from './create-translation-service';
import { describe, expect, test, vi } from 'vitest';

import { ApiKey } from '../src/core/domain/credential/ApiKey';
import { Credential } from '../src/core/domain/credential/Credential';
import type { Provider } from '../src/core/domain/credential/Provider';
import { EncodedImage } from '../src/core/domain/image/EncodedImage';
import { UserPreferences } from '../src/core/domain/preferences/UserPreferences';
import { Language } from '../src/core/domain/translation/Language';
import { FakeTranslationCapabilityStorage } from './fakes/FakeTranslationCapabilityStorage';
import { createTranslationFixture } from './fixtures/translation-provider-server';

interface ThinkingCase {
  provider: Provider;
  model: string;
  protocol: 'openai' | 'anthropic';
  control: string;
  expected: Record<string, unknown>[];
}

const cases: ThinkingCase[] = [
  {
    provider: 'deepseek',
    model: 'deepseek-flash',
    protocol: 'openai',
    control: 'thinking.type',
    expected: [
      { thinking: { type: 'disabled' } },
      { thinking: { type: 'enabled' }, reasoning_effort: 'low' },
      {},
    ],
  },
  {
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    protocol: 'anthropic',
    control: 'thinking.type',
    expected: [
      { thinking: { type: 'between_tools' } },
      { thinking: { type: 'adaptive' }, output_config: { effort: 'low' } },
      {},
    ],
  },
  {
    provider: 'nvidia',
    model: 'nvidia/nemotron-3.5-super-vl-120b-a12b',
    protocol: 'openai',
    control: 'chat_template_kwargs',
    expected: [
      { chat_template_kwargs: { enable_thinking: false } },
      { reasoning_effort: 'low' },
      {},
    ],
  },
  {
    provider: 'mistral',
    model: 'mistral-large-4-0',
    protocol: 'openai',
    control: 'reasoning_effort',
    expected: [{ reasoning_effort: 'none' }, {}],
  },
];

function setup(
  provider: Provider,
  model: string,
  storage: FakeTranslationCapabilityStorage,
) {
  const key = ApiKey.createWithProvider('fixture-key', provider);
  const image = EncodedImage.create('data:image/png;base64,AQ==');

  if (!key.success || !image.success) throw new Error('Invalid fixture input');

  const credential = Credential.create(crypto.randomUUID(), key.data, provider);

  if (!credential.success) throw credential.error;

  const service = createTranslationAdapter(
    credential.data,
    UserPreferences.createDefault(crypto.randomUUID()).withSelectedModel(
      provider,
      model,
    ),
    undefined,
    storage,
  );

  return { service, image: image.data };
}

function rejection(control: string, inBand: boolean): Response {
  const error = {
    type: 'invalid_request_error',
    code: 'unsupported_parameter',
    param: control,
    message: `${control} is not supported for this model`,
  };

  return inBand
    ? new Response(`data: ${JSON.stringify({ error })}\n\ndata: [DONE]\n\n`, {
        headers: { 'content-type': 'text/event-stream' },
      })
    : Response.json({ type: 'error', error }, { status: 400 });
}

describe('Thinking fallback through installed provider SDKs', () => {
  test.each(
    cases.flatMap((item) =>
      [...new Set([1, item.expected.length - 1])].map((rejectCount) =>
        Object.assign({}, item, { rejectCount }),
      ),
    ),
  )(
    '$provider/$model handles $rejectCount rejected configurations and remembers the working request',
    async ({ provider, model, protocol, control, expected, rejectCount }) => {
      const fixture = createTranslationFixture({ delayMs: 0 });
      const bodies: Record<string, unknown>[] = [];

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async (input, init) => {
          const request = new Request(input, init);

          bodies.push(await request.clone().json());

          if (bodies.length <= rejectCount) {
            const field =
              bodies.length === 1
                ? control
                : protocol === 'anthropic'
                  ? 'output_config.effort'
                  : 'reasoning_effort';

            return rejection(field, false);
          }

          return fixture.fetch(
            new Request(
              `http://fixture.invalid/${protocol}/success/v1/${protocol === 'openai' ? 'chat/completions' : 'messages'}`,
              request,
            ),
          );
        });

      try {
        const storage = new FakeTranslationCapabilityStorage();
        const { service, image } = setup(provider, model, storage);

        const result = await service.translateImage(
          image,
          Language.create('en-US'),
        );

        expect(result.success, result.success ? '' : result.error.message).toBe(
          true,
        );

        expect(bodies).toHaveLength(rejectCount + 1);

        bodies.forEach((body, index) =>
          expect(body).toMatchObject(expected[index]),
        );

        const finalBody = bodies.at(-1)!;

        if (rejectCount === expected.length - 1) {
          for (const field of [
            'thinking',
            'reasoning',
            'reasoning_effort',
            'chat_template_kwargs',
          ])
            expect(finalBody).not.toHaveProperty(field);
        }

        // Recreate the adapter to prove selection comes from storage, not its instance.
        const repeated = setup(provider, model, storage);

        expect(
          (
            await repeated.service.translateImage(
              repeated.image,
              Language.create('en-US'),
            )
          ).success,
        ).toBe(true);

        expect(bodies).toHaveLength(rejectCount + 2);
        expect(bodies.at(-1)).toEqual(finalBody);

        const facts = Object.entries(
          [...storage.records.values()][0].facts,
        ).filter(([key]) => key.startsWith('configuration.'));

        expect(
          facts.filter(([, fact]) => fact.support === 'unsupported'),
        ).toHaveLength(rejectCount);

        expect(
          facts.filter(([, fact]) => fact.support === 'supported'),
        ).toHaveLength(1);
      } finally {
        fetchSpy.mockRestore();
      }
    },
  );

  test('an explicit in-band DeepSeek control rejection falls back without changing streaming mode', async () => {
    const fixture = createTranslationFixture({ delayMs: 0 });
    let requests = 0;

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const request = new Request(input, init);

        if (++requests === 1) return rejection('thinking.type', true);

        return fixture.fetch(
          new Request(
            'http://fixture.invalid/openai/success/v1/chat/completions',
            request,
          ),
        );
      });

    try {
      const storage = new FakeTranslationCapabilityStorage();
      const { service, image } = setup('deepseek', 'deepseek-flash', storage);

      const result = await service.translateImage(
        image,
        Language.create('en-US'),
      );

      expect(result.success, result.success ? '' : result.error.message).toBe(
        true,
      );

      expect(requests).toBe(2);

      expect(fixture.requests.map((request) => request.streamed)).toEqual([
        true,
      ]);

      expect(
        [...storage.records.values()][0].facts['feature.stream'].support,
      ).toBe('supported');
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
