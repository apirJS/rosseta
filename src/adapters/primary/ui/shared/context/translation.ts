import { getContext, setContext } from 'svelte';
import type { IGetAllTranslationsUseCase } from '../../../../../core/ports/inbound/translation/IGetAllTranslationsUseCase';
import type { IDeleteTranslationUseCase } from '../../../../../core/ports/inbound/translation/IDeleteTranslationUseCase';
import type { IClearAllTranslationsUseCase } from '../../../../../core/ports/inbound/translation/IClearAllTranslationsUseCase';

const TRANSLATION_CONTEXT_KEY = Symbol('translation');

export interface TranslationUseCases {
  getAllTranslations: IGetAllTranslationsUseCase;
  deleteTranslation: IDeleteTranslationUseCase;
  clearAllTranslations: IClearAllTranslationsUseCase;
}

export function setTranslationContext(useCases: TranslationUseCases): void {
  setContext(TRANSLATION_CONTEXT_KEY, useCases);
}

export function getTranslationContext(): TranslationUseCases {
  const context = getContext<TranslationUseCases>(TRANSLATION_CONTEXT_KEY);
  if (!context) {
    throw new Error(
      'Translation context not found. Did you forget to call setTranslationContext?',
    );
  }
  return context;
}
