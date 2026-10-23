/** Bind verified native API fields when an installed SDK cannot forward them. */
export function configuredGenerationFetch(
  fields: Readonly<Record<string, unknown>> | undefined,
  fetcher: typeof fetch = globalThis.fetch,
): typeof fetch | undefined {
  if (!fields || !Object.keys(fields).length) return undefined;

  return (async (input, init) => {
    const request = new Request(input, init);

    if (
      request.method !== 'POST' ||
      !/\/(?:chat\/completions|responses|messages)$/.test(
        new URL(request.url).pathname,
      )
    ) {
      return fetcher(request);
    }

    const body: unknown = await request.json();

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new Error('Invalid SDK generation request body');
    }

    return fetcher(
      new Request(request, {
        method: 'POST',
        body: JSON.stringify({ ...body, ...fields }),
      }),
    );
  }) as typeof fetch;
}
