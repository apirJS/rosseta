import type { IGetAllTranslationsUseCase } from '../../../../core/ports/inbound/translation/IGetAllTranslationsUseCase';

/** Reading history applies storage retention without delaying worker startup. */
export async function pruneExpiredTranslationHistory(
  getAllTranslations: IGetAllTranslationsUseCase,
): Promise<void> {
  try {
    const result = await getAllTranslations.execute();
    if (!result.success) {
      console.warn(
        '[TranslationHistory] Failed to prune expired history:',
        result.error,
      );
    }
  } catch (error) {
    console.warn(
      '[TranslationHistory] Failed to prune expired history:',
      error,
    );
  }
}
