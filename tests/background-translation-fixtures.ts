import { mock } from 'bun:test';
import type { Container } from '../src/shared/di/container-factory';
import type { TranslateImageCommand } from '../src/core/ports/inbound/translation/ITranslateImageUseCase';
import type { ITranslationRequestPreparer } from '../src/adapters/primary/background/services/TranslationRequestPreparer';
import type { TranslationEvent } from '../src/shared/validation/MessageSchema';
import { Translation } from '../src/core/domain/translation/Translation';
import { Language } from '../src/core/domain/translation/Language';
import { TextSegment } from '../src/core/domain/translation/TextSegment';
import { SaveTranslationUseCase } from '../src/core/application/translation/SaveTranslationUseCase';
import { GetTranslationUseCase } from '../src/core/application/translation/GetTranslationUseCase';
import { FakeTranslationStorage } from './fakes/FakeTranslationStorage';
import { success, type Result } from '../src/shared/types/Result';
import type { AppError } from '../src/shared/errors';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

export async function nextTurn(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

export function completeTranslation(id = 'translation-1'): Translation {
  const original = TextSegment.create(
    'こんにちは',
    Language.create('ja-JP'),
    'konnichiwa',
    0,
  );
  const translated = TextSegment.create(
    'Hello',
    Language.create('en-US'),
    null,
    0,
  );
  if (!original.success || !translated.success)
    throw new Error('Invalid test translation');
  return Translation.create(
    id,
    [original.data],
    [translated.data],
    'A greeting',
    new Date('2026-10-19T00:00:00Z'),
  );
}

export const translationIdentity = {
  requestId: 'request-1',
  documentSessionId: 'session-1',
};
export const translationOrigin = {
  tabId: 11,
  frameId: 3,
  documentId: 'document-1',
};
export const translationDraft = (text: string) => ({
  segments: [
    {
      index: 0,
      blockIndex: 0,
      originalText: 'こんにちは',
      translatedText: text,
      sourceLanguageCode: 'ja-JP',
      romanization: null,
    },
  ],
  description: null,
});

export function coordinatorFixture(
  execute?: (
    command: TranslateImageCommand,
  ) => Promise<Result<Translation, AppError>>,
) {
  const storage = new FakeTranslationStorage();
  const generation = mock(
    execute ?? (async () => success(completeTranslation())),
  );
  const prepare = mock(async () =>
    success({
      useCase: { execute: generation },
      targetLanguage: { code: 'en-US', name: 'English' },
    }),
  );
  const preparer: ITranslationRequestPreparer = { prepare };
  const saveTranslationUseCase = new SaveTranslationUseCase(storage);
  const getTranslationUseCase = new GetTranslationUseCase(storage);
  const container = {
    saveTranslationUseCase,
    getTranslationUseCase,
  } as unknown as Container;
  return {
    storage,
    generation,
    prepare,
    preparer,
    container,
    saveTranslationUseCase,
    getTranslationUseCase,
  };
}

export function sentTranslationEvents(
  calls: readonly unknown[][],
): TranslationEvent[] {
  return calls.flatMap((call) => {
    const message = call[1] as
      | { action?: string; payload?: TranslationEvent }
      | undefined;
    return message?.action === 'TRANSLATION_EVENT' && message.payload
      ? [message.payload]
      : [];
  });
}
