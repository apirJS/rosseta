export function buildCustomProviderURL(
  baseURL: string,
  path: string,
  queryParams?: Record<string, string>,
): string {
  const url = new URL(baseURL);
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  for (const [name, value] of Object.entries(queryParams ?? {})) {
    url.searchParams.set(name, value);
  }
  return url.toString();
}

export function createQueryParamFetch(
  queryParams?: Record<string, string>,
): typeof fetch {
  if (!queryParams || Object.keys(queryParams).length === 0) {
    return globalThis.fetch;
  }

  return ((input, init) => {
    const inputURL =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const url = new URL(inputURL);
    for (const [name, value] of Object.entries(queryParams)) {
      url.searchParams.set(name, value);
    }

    const request = input instanceof Request ? new Request(url, input) : url;
    return globalThis.fetch(request, init);
  }) as typeof fetch;
}
