import { describe, expect, test } from 'bun:test';
import { serializeForModal } from './TranslationModalHandler';
import { Translation } from '../../../../core/domain/translation/Translation';
import { TextSegment } from '../../../../core/domain/translation/TextSegment';
import {
  Language,
  type LanguageCode,
} from '../../../../core/domain/translation/Language';
import { v4 as uuidv4 } from 'uuid';

function seg(
  text: string,
  lang: LanguageCode,
  romanization: string | null = null,
) {
  const result = TextSegment.create(text, Language.create(lang), romanization);
  if (!result.success) throw result.error;
  return result.data;
}

describe('serializeForModal', () => {
  test('maps a Translation domain object to TranslationModalPayload', () => {
    const translation = new Translation(
      uuidv4(),
      [seg('こんにちは', 'ja-JP', 'konnichiwa')],
      [seg('Hello', 'en-US')],
      'A greeting in Japanese',
      new Date('2026-01-01T00:00:00Z'),
    );

    const payload = serializeForModal(translation);

    expect(payload.id).toBe(translation.id);
    expect(payload.description).toBe('A greeting in Japanese');
    expect(payload.createdAt).toEqual(new Date('2026-01-01T00:00:00Z'));

    expect(payload.original).toHaveLength(1);
    expect(payload.original[0]).toEqual({
      language: { code: 'ja-JP', name: 'Japanese' },
      text: 'こんにちは',
      romanization: 'konnichiwa',
    });

    expect(payload.translated).toHaveLength(1);
    expect(payload.translated[0]).toEqual({
      language: { code: 'en-US', name: 'English' },
      text: 'Hello',
      romanization: null,
    });
  });

  test('handles multiple text segments', () => {
    const translation = new Translation(
      uuidv4(),
      [
        seg('こんにちは', 'ja-JP', 'konnichiwa'),
        seg('ありがとう', 'ja-JP', 'arigatou'),
      ],
      [seg('Hello', 'en-US'), seg('Thank you', 'en-US')],
      'Greetings',
      new Date('2026-01-01'),
    );

    const payload = serializeForModal(translation);

    expect(payload.original).toHaveLength(2);
    expect(payload.translated).toHaveLength(2);
    expect(payload.original[1].text).toBe('ありがとう');
    expect(payload.translated[1].text).toBe('Thank you');
  });
});
