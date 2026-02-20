import type { ITranslationStorage } from '../../../core/ports/outbound/ITranslationStorage';
import {
  Translation,
  type TranslationProps,
} from '../../../core/domain/translation/Translation';
import { TextSegment } from '../../../core/domain/translation/TextSegment';
import { Language } from '../../../core/domain/translation/Language';

import { success, failure, type Result } from '../../../shared/types/Result';
import { StorageError, type AppError } from '../../../shared/errors';
import * as browser from 'webextension-polyfill';
import { z } from 'zod';

const STORAGE_KEY = 'translations';

const TextSegmentSchema = z.object({
  text: z.string(),
  languageCode: z.string(),
  languageName: z.string(),
  romanization: z.string().nullable(),
});

const TranslationPropsSchema = z.object({
  id: z.string(),
  original: z.array(TextSegmentSchema),
  translated: z.array(TextSegmentSchema),
  description: z.string(),
  createdAt: z.string(),
});

export class BrowserTranslationStorageAdapter implements ITranslationStorage {
  async save(translation: Translation): Promise<Result<void, AppError>> {
    try {
      const allResult = await this.getAllRaw();
      if (!allResult.success) return failure(allResult.error);

      const items = allResult.data;
      // Replace if exists, otherwise prepend
      const existingIndex = items.findIndex((i) => i.id === translation.id);
      const props = translation.toProps();

      if (existingIndex >= 0) {
        items[existingIndex] = props;
      } else {
        items.unshift(props);
      }

      await browser.storage.local.set({ [STORAGE_KEY]: items });
      return success(undefined);
    } catch (error) {
      return failure(
        StorageError.writeFailed(
          STORAGE_KEY,
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  async getById(id: string): Promise<Result<Translation | null, AppError>> {
    try {
      const allResult = await this.getAllRaw();
      if (!allResult.success) return failure(allResult.error);

      const raw = allResult.data.find((i) => i.id === id);
      if (!raw) return success(null);

      return this.toDomain(raw);
    } catch (error) {
      return failure(StorageError.readFailed(STORAGE_KEY));
    }
  }

  async getAll(): Promise<Result<Translation[], AppError>> {
    try {
      const allResult = await this.getAllRaw();
      if (!allResult.success) return failure(allResult.error);

      const translations: Translation[] = [];
      for (const raw of allResult.data) {
        const result = this.toDomain(raw);
        if (result.success) {
          translations.push(result.data);
        }
        // Skip corrupted entries silently
      }

      return success(translations);
    } catch (error) {
      return failure(StorageError.readFailed(STORAGE_KEY));
    }
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    try {
      const allResult = await this.getAllRaw();
      if (!allResult.success) return failure(allResult.error);

      const filtered = allResult.data.filter((i) => i.id !== id);
      await browser.storage.local.set({ [STORAGE_KEY]: filtered });
      return success(undefined);
    } catch (error) {
      return failure(
        StorageError.writeFailed(
          STORAGE_KEY,
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  async clear(): Promise<Result<void, AppError>> {
    try {
      await browser.storage.local.remove(STORAGE_KEY);
      return success(undefined);
    } catch (error) {
      return failure(
        StorageError.writeFailed(
          STORAGE_KEY,
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  private async getAllRaw(): Promise<Result<TranslationProps[], AppError>> {
    try {
      const result = await browser.storage.local.get(STORAGE_KEY);
      const raw = result[STORAGE_KEY];

      if (!raw || !Array.isArray(raw)) {
        return success([]);
      }

      const validated: TranslationProps[] = [];
      for (const item of raw) {
        const parsed = TranslationPropsSchema.safeParse(item);
        if (parsed.success) {
          validated.push(parsed.data);
        }
      }

      return success(validated);
    } catch (error) {
      return failure(StorageError.readFailed(STORAGE_KEY));
    }
  }

  private toDomain(raw: TranslationProps): Result<Translation, AppError> {
    const originalSegments: TextSegment[] = [];
    const translatedSegments: TextSegment[] = [];

    for (const seg of raw.original) {
      const langResult = Language.fromRaw(seg.languageCode);
      if (!langResult.success) continue;
      const segResult = TextSegment.create(
        seg.text,
        langResult.data,
        seg.romanization,
      );
      if (!segResult.success) continue;
      originalSegments.push(segResult.data);
    }

    for (const seg of raw.translated) {
      const langResult = Language.fromRaw(seg.languageCode);
      if (!langResult.success) continue;
      const segResult = TextSegment.create(
        seg.text,
        langResult.data,
        seg.romanization,
      );
      if (!segResult.success) continue;
      translatedSegments.push(segResult.data);
    }

    return success(
      new Translation(
        raw.id,
        originalSegments,
        translatedSegments,
        raw.description,
        new Date(raw.createdAt),
      ),
    );
  }
}
