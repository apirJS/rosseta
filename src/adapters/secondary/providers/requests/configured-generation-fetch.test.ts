import { describe, expect, spyOn, test } from 'bun:test';
import { configuredGenerationFetch } from './configured-generation-fetch';

describe('Adapter: configured native generation fetch', () => {
  test('leaves SDK transport unchanged when no native fields are requested', () => {
    expect(configuredGenerationFetch(undefined)).toBeUndefined();
    expect(configuredGenerationFetch({})).toBeUndefined();
  });

  test('patches only verified fields while preserving request headers, image body, and cancellation', async () => {
    const controller = new AbortController();
    const bodies: unknown[] = [];
    const requests: Request[] = [];

    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (
      input,
    ) => {
      const request = new Request(input);

      requests.push(request);
      bodies.push(await request.json());

      return new Response('{}');
    }) as typeof fetch);

    try {
      const send = configuredGenerationFetch({ reasoning_effort: 'none' });

      if (!send) throw new Error('Expected configured fetch');

      await send('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: 'Bearer fixture',
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'mistral-large-4-0',
          messages: [{ content: 'image-fixture' }],
          temperature: 0,
        }),
      });

      expect(bodies).toEqual([
        {
          model: 'mistral-large-4-0',
          messages: [{ content: 'image-fixture' }],
          temperature: 0,
          reasoning_effort: 'none',
        },
      ]);

      expect(requests[0].headers.get('authorization')).toBe('Bearer fixture');
      controller.abort();
      expect(requests[0].signal.aborted).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test('does not add generation fields to model-discovery requests', async () => {
    const paths: string[] = [];

    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (
      input,
    ) => {
      const request = new Request(input);

      paths.push(new URL(request.url).pathname);
      expect(request.body).toBeNull();

      return new Response('{}');
    }) as typeof fetch);

    try {
      const send = configuredGenerationFetch({ reasoning_effort: 'none' });

      if (!send) throw new Error('Expected configured fetch');
      await send('https://api.mistral.ai/v1/models');
      expect(paths).toEqual(['/v1/models']);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
