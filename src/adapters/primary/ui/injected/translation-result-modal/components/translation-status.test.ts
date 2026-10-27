import { describe, expect, test } from 'vitest';
import { formatTranslationStatus } from './translation-status';

describe('translation status label', () => {
  test.each(['Translating...', 'Translating…', 'Translating'])(
    'removes fixed dots from busy label %s',
    (status) => {
      expect(formatTranslationStatus(status, true)).toBe('Translating');
    },
  );

  test('keeps non-busy text and internal punctuation', () => {
    expect(formatTranslationStatus('Complete...', false)).toBe('Complete...');

    expect(formatTranslationStatus('Preparing... still working', true)).toBe(
      'Preparing... still working',
    );

    expect(formatTranslationStatus('', true)).toBe('');
  });
});
