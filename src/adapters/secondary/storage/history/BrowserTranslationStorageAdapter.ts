import type { ITranslationStorage } from '../../../../core/ports/outbound/ITranslationStorage';
import {
  Translation,
  type TranslationProps,
} from '../../../../core/domain/translation/Translation';
import { TextSegment } from '../../../../core/domain/translation/TextSegment';
import { Language } from '../../../../core/domain/translation/Language';
import { isWithinHistoryRetention } from '../../../../core/domain/translation/translation-history-retention';
import { serializeHistoryStorage } from './translation-history-lock';

import { success, failure, type Result } from '../../../../shared/types/Result';
import { StorageError, type AppError } from '../../../../shared/errors';
import * as browser from 'webextension-polyfill';
import { z } from 'zod';

const STORAGE_KEY = 'translations';

async function serializeMutation<T>(
  work: () => Promise<Result<T, AppError>>,
): Promise<Result<T, AppError>> {
  try {
    return await serializeHistoryStorage(work);
  } catch (error) {
    return failure(
      StorageError.writeFailed(
        STORAGE_KEY,
        error instanceof Error ? error : undefined,
      ),
    );
  }
}

const TextSegmentSchema = z.object({
  text: z.string(),
  languageCode: z.string(),
  languageName: z.string(),
  romanization: z.string().nullable(),
  blockIndex: z.number().int().nonnegative(),
});

const TranslationPropsSchema = z.object({
  id: z.string(),
  original: z.array(TextSegmentSchema),
  translated: z.array(TextSegmentSchema),
  description: z.string(),
  createdAt: z.string(),
});

export class BrowserTranslationStorageAdapter implements ITranslationStorage {
  constructor(private readonly now: () => number = Date.now) {}

  async save(translation: Translation): Promise<Result<void, AppError>> {
    return serializeMutation(async () => {
      try {
        const allResult = await this.getAllRaw();

        if (!allResult.success) return failure(allResult.error);

        const items = allResult.data;
        const existingIndex = items.findIndex((i) => i.id === translation.id);
        const props = translation.toProps();

        if (existingIndex >= 0) {
          items[existingIndex] = props;
        } else {
          items.unshift(props);
        }

        await browser.storage.local.set({
          [STORAGE_KEY]: this.retainRecentHistory(items),
        });

        return success(undefined);
      } catch (error) {
        return failure(
          StorageError.writeFailed(
            STORAGE_KEY,
            error instanceof Error ? error : undefined,
          ),
        );
      }
    });
  }

  async getById(id: string): Promise<Result<Translation | null, AppError>> {
    return serializeMutation(async () => {
      const allResult = await this.readRetainedHistory();

      if (!allResult.success) return failure(allResult.error);

      const raw = allResult.data.find((i) => i.id === id);

      if (!raw) return success(null);

      return this.toDomain(raw);
    });
  }

  async getAll(): Promise<Result<Translation[], AppError>> {
    return serializeMutation(async () => {
      const allResult = await this.readRetainedHistory();

      if (!allResult.success) return failure(allResult.error);

      const translations: Translation[] = [];

      for (const raw of allResult.data) {
        const result = this.toDomain(raw);

        if (result.success) {
          translations.push(result.data);
        }
      }

      return success(translations);
    });
  }

  async replaceAll(
    translations: Translation[],
  ): Promise<Result<void, AppError>> {
    return serializeMutation(async () => {
      try {
        await browser.storage.local.set({
          [STORAGE_KEY]: this.retainRecentHistory(
            translations.map((translation) => translation.toProps()),
          ),
        });

        return success(undefined);
      } catch (error) {
        return failure(
          StorageError.writeFailed(
            STORAGE_KEY,
            error instanceof Error ? error : undefined,
          ),
        );
      }
    });
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    return serializeMutation(async () => {
      try {
        const allResult = await this.getAllRaw();

        if (!allResult.success) return failure(allResult.error);

        const filtered = this.retainRecentHistory(allResult.data).filter(
          (i) => i.id !== id,
        );

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
    });
  }

  async clear(): Promise<Result<void, AppError>> {
    return serializeMutation(async () => {
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
    });
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
    } catch {
      return failure(StorageError.readFailed(STORAGE_KEY));
    }
  }

  private retainRecentHistory(items: TranslationProps[]): TranslationProps[] {
    const now = this.now();

    return items.filter((item) =>
      isWithinHistoryRetention(new Date(item.createdAt), now),
    );
  }

  private async readRetainedHistory(): Promise<
    Result<TranslationProps[], AppError>
  > {
    const result = await this.getAllRaw();

    if (!result.success) return result;

    const retained = this.retainRecentHistory(result.data);

    if (retained.length === result.data.length) return success(retained);

    try {
      await browser.storage.local.set({ [STORAGE_KEY]: retained });

      return success(retained);
    } catch (error) {
      return failure(
        StorageError.writeFailed(
          STORAGE_KEY,
          error instanceof Error ? error : undefined,
        ),
      );
    }
  }

  private toDomain(raw: TranslationProps): Result<Translation, AppError> {
    const originalSegments: TextSegment[] = [];
    const translatedSegments: TextSegment[] = [];

    for (const seg of raw.original) {
      const langResult = Language.fromRaw(seg.languageCode);

      if (!langResult.success) {
        console.warn(
          '[TranslationStorage] Skipping original segment — invalid language:',
          seg.languageCode,
        );

        continue;
      }

      const segResult = TextSegment.create(
        seg.text,
        langResult.data,
        seg.romanization,
        seg.blockIndex,
      );

      if (!segResult.success) {
        console.warn(
          '[TranslationStorage] Skipping original segment — invalid data:',
          seg.text,
        );

        continue;
      }

      originalSegments.push(segResult.data);
    }

    for (const seg of raw.translated) {
      const langResult = Language.fromRaw(seg.languageCode);

      if (!langResult.success) {
        console.warn(
          '[TranslationStorage] Skipping translated segment — invalid language:',
          seg.languageCode,
        );

        continue;
      }

      const segResult = TextSegment.create(
        seg.text,
        langResult.data,
        seg.romanization,
        seg.blockIndex,
      );

      if (!segResult.success) {
        console.warn(
          '[TranslationStorage] Skipping translated segment — invalid data:',
          seg.text,
        );

        continue;
      }

      translatedSegments.push(segResult.data);
    }

    return success(
      Translation.create(
        raw.id,
        originalSegments,
        translatedSegments,
        raw.description,
        new Date(raw.createdAt),
      ),
    );
  }
}
