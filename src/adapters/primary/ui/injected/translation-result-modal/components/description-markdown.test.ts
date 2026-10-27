import { describe, expect, test } from 'vitest';
import { sanitizeDescriptionUrl } from './description-markdown';

describe('description link policy', () => {
  test.each([
    ['https://example.com/guide', 'https://example.com/guide'],
    ['http://example.com', 'http://example.com/'],
    ['HTTPS://EXAMPLE.COM/a b', 'https://example.com/a%20b'],
  ])('accepts and normalizes web destination %s', (value, expected) => {
    expect(sanitizeDescriptionUrl(value)).toBe(expected);
  });

  test.each([
    'javascript:alert(1)',
    'data:text/html,unsafe',
    'file:///private.txt',
    '/relative',
    '#heading',
    '//example.com',
    'mailto:person@example.com',
    '',
  ])('rejects non-web and relative destination %s', (value) => {
    expect(sanitizeDescriptionUrl(value)).toBe('');
  });
});
