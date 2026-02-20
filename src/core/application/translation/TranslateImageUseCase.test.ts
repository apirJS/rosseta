import { describe, expect, test } from 'bun:test';
import { TranslateImageUseCase } from './TranslateImageUseCase';
import { FakeTranslationService } from '../../../../tests/fakes/FakeTranslationService';
import type { TranslateImageCommand } from '../../ports/inbound/translation/ITranslateImageUseCase';
import { Translation } from '../../domain/translation/Translation';
import { TranslationError, ErrorCode } from '../../../shared/errors';

const VALID_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';

function createUseCase() {
  const service = new FakeTranslationService();
  const useCase = new TranslateImageUseCase(service);
  return { service, useCase };
}

describe('Application: TranslateImageUseCase', () => {
  // ==================== HAPPY PATH ====================
  test('successfully translates an image', async () => {
    const { useCase } = createUseCase();
    const command: TranslateImageCommand = {
      imageBase64: VALID_PNG_DATA_URL,
      targetLanguageCode: 'en-US',
    };

    const result = await useCase.execute(command);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeInstanceOf(Translation);
    }
  });

  test('returns custom translation from service', async () => {
    const { service, useCase } = createUseCase();
    const expected = new Translation(
      'custom-1',
      [],
      [],
      'Custom result',
      new Date(),
    );
    service.willReturn(expected);

    const command: TranslateImageCommand = {
      imageBase64: VALID_PNG_DATA_URL,
      targetLanguageCode: 'ja-JP',
    };

    const result = await useCase.execute(command);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('custom-1');
      expect(result.data.description).toBe('Custom result');
    }
  });

  // ==================== VALIDATION FAILURES ====================
  test('fails with unsupported language code', async () => {
    const { useCase } = createUseCase();
    const command: TranslateImageCommand = {
      imageBase64: VALID_PNG_DATA_URL,
      targetLanguageCode: 'xx-FAKE',
    };

    const result = await useCase.execute(command);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(TranslationError);
      expect(result.error.code).toBe(
        ErrorCode.TRANSLATION_UNSUPPORTED_LANGUAGE,
      );
    }
  });

  test('fails with invalid image data', async () => {
    const { useCase } = createUseCase();
    const command: TranslateImageCommand = {
      imageBase64: 'not-a-data-url',
      targetLanguageCode: 'en-US',
    };

    const result = await useCase.execute(command);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(TranslationError);
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_INVALID_IMAGE);
    }
  });

  // ==================== SERVICE FAILURE ====================
  test('fails when translation service fails', async () => {
    const { service, useCase } = createUseCase();
    service.failWith(TranslationError.failed());

    const command: TranslateImageCommand = {
      imageBase64: VALID_PNG_DATA_URL,
      targetLanguageCode: 'en-US',
    };

    const result = await useCase.execute(command);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(TranslationError);
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_FAILED);
    }
  });

  test('fails when service returns rate limited', async () => {
    const { service, useCase } = createUseCase();
    service.failWith(TranslationError.rateLimited());

    const command: TranslateImageCommand = {
      imageBase64: VALID_PNG_DATA_URL,
      targetLanguageCode: 'en-US',
    };

    const result = await useCase.execute(command);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(TranslationError);
      expect(result.error.code).toBe(ErrorCode.TRANSLATION_RATE_LIMITED);
    }
  });
});
