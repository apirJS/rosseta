export function sanitizeDescriptionUrl(value: string): string {
  try {
    const url = new URL(value);

    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : '';
  } catch {
    return '';
  }
}
