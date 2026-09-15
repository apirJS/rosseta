import { describe, expect, test, beforeEach } from 'bun:test';
import { TranslateImageHandler } from './TranslateImageHandler';
import { generateTextMock } from '../../../../../tests/browser-mock';
import { FakeCredentialStorage } from '../../../../../tests/fakes/FakeCredentialStorage';
import { FakeKeySelectionStorage } from '../../../../../tests/fakes/FakeKeySelectionStorage';
import { FakeUserPreferencesStorage } from '../../../../../tests/fakes/FakeUserPreferencesStorage';
import { FakeModelStorage } from '../../../../../tests/fakes/FakeModelStorage';
import { FakeTranslationStorage } from '../../../../../tests/fakes/FakeTranslationStorage';
import { FakeStructuredOutputExemptionStorage } from '../../../../../tests/fakes/FakeStructuredOutputExemptionStorage';
import { GetCredentialsUseCase } from '../../../../core/application/auth/GetCredentialUseCase';
import { ResolveActiveCredentialUseCase } from '../../../../core/application/auth/ResolveActiveCredentialUseCase';
import { GetPreferencesUseCase } from '../../../../core/application/preferences/GetPreferencesUseCase';
import { UpdatePreferencesUseCase } from '../../../../core/application/preferences/UpdatePreferencesUseCase';
import { LoadModelsUseCase } from '../../../../core/application/models/LoadModelsUseCase';
import { SaveTranslationUseCase } from '../../../../core/application/translation/SaveTranslationUseCase';
import { Credentials } from '../../../../core/domain/credential/Credentials';
import { Credential } from '../../../../core/domain/credential/Credential';
import { ApiKey } from '../../../../core/domain/credential/ApiKey';
import { UserPreferences } from '../../../../core/domain/preferences/UserPreferences';
import type { Container } from '../../../../shared/di/container-factory';
import {
  VALID_IMAGE_BASE64,
  VALID_TRANSLATION_RESPONSE,
} from '../../../../../tests/test-fixtures';
import { v4 as uuidv4 } from 'uuid';

function makeGoogleCredential(id: string, key: string) {
  const apiKey = ApiKey.createWithProvider(key, 'google');
  if (!apiKey.success) throw new Error('bad key');
  const cred = Credential.create(id, apiKey.data, 'google');
  if (!cred.success) throw new Error('bad cred');
  return cred.data;
}

function createTestContainer() {
  const credentialStorage = new FakeCredentialStorage();
  const keySelectionStorage = new FakeKeySelectionStorage();
  const preferencesStorage = new FakeUserPreferencesStorage();
  const modelStorage = new FakeModelStorage();
  const translationStorage = new FakeTranslationStorage();

  credentialStorage.seedWith(
    Credentials.createEmpty(uuidv4()).add(
      makeGoogleCredential('g1', 'AIzaGoogleKey'),
    ),
  );

  const container = {
    getCredentialsUseCase: new GetCredentialsUseCase(credentialStorage),
    resolveActiveCredentialUseCase: new ResolveActiveCredentialUseCase(
      keySelectionStorage,
    ),
    getPreferencesUseCase: new GetPreferencesUseCase(preferencesStorage),
    updatePreferencesUseCase: new UpdatePreferencesUseCase(preferencesStorage),
    loadModelsUseCase: new LoadModelsUseCase(modelStorage),
    saveTranslationUseCase: new SaveTranslationUseCase(translationStorage),
    structuredOutputExemptionStorage:
      new FakeStructuredOutputExemptionStorage(),
  } as unknown as Container;

  return { container, preferencesStorage, modelStorage, translationStorage };
}

function seedPreferences(selectedModels: Record<string, string>) {
  const result = UserPreferences.fromRaw({
    id: uuidv4(),
    theme: 'system',
    targetLanguage: 'en-US',
    selectedModels,
  });
  if (!result.success) throw new Error('bad prefs');
  return result.data;
}

function lastCalledModelId(): string {
  const callArgs = generateTextMock.mock.calls[0][0] as {
    model: { modelId: string };
  };
  return callArgs.model.modelId;
}

describe('Adapter: TranslateImageHandler', () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    generateTextMock.mockResolvedValueOnce({
      output: VALID_TRANSLATION_RESPONSE,
    });
  });

  test('translates successfully and saves the translation', async () => {
    const { container, translationStorage } = createTestContainer();
    const handler = new TranslateImageHandler(container);

    const result = await handler.handle(
      { imageBase64: VALID_IMAGE_BASE64 },
      1,
    );

    expect(result.success).toBe(true);
    expect(translationStorage.storedCount).toBe(1);
  });

  test('repairs a stale model selection to the registry default and persists it', async () => {
    const { container, preferencesStorage, modelStorage } =
      createTestContainer();
    preferencesStorage.seed(
      seedPreferences({ google: 'dead-model', groq: 'llama-4' }),
    );
    modelStorage.seedModels('google', [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', source: 'fetched' },
      { id: 'other-model', name: 'Other', source: 'fetched' },
    ]);
    const handler = new TranslateImageHandler(container);

    const result = await handler.handle(
      { imageBase64: VALID_IMAGE_BASE64 },
      1,
    );

    expect(result.success).toBe(true);
    expect(lastCalledModelId()).toBe('gemini-2.5-flash');
    expect(preferencesStorage.stored?.getModelIdFor('google')).toBe(
      'gemini-2.5-flash',
    );
    expect(preferencesStorage.stored?.getModelIdFor('groq')).toBe('llama-4');
    expect(preferencesStorage.setCalls).toHaveLength(1);
  });

  test('repairs to the first stored model when the default is absent too', async () => {
    const { container, preferencesStorage, modelStorage } =
      createTestContainer();
    preferencesStorage.seed(seedPreferences({ google: 'dead-model' }));
    modelStorage.seedModels('google', [
      { id: 'm1', name: 'Model 1', source: 'fetched' },
      { id: 'm2', name: 'Model 2', source: 'fetched' },
    ]);
    const handler = new TranslateImageHandler(container);

    const result = await handler.handle(
      { imageBase64: VALID_IMAGE_BASE64 },
      1,
    );

    expect(result.success).toBe(true);
    expect(lastCalledModelId()).toBe('m1');
    expect(preferencesStorage.stored?.getModelIdFor('google')).toBe('m1');
  });

  test('does not rewrite preferences when the selection is valid', async () => {
    const { container, preferencesStorage, modelStorage } =
      createTestContainer();
    preferencesStorage.seed(seedPreferences({ google: 'm2' }));
    modelStorage.seedModels('google', [
      { id: 'm1', name: 'Model 1', source: 'fetched' },
      { id: 'm2', name: 'Model 2', source: 'fetched' },
    ]);
    const handler = new TranslateImageHandler(container);

    const result = await handler.handle(
      { imageBase64: VALID_IMAGE_BASE64 },
      1,
    );

    expect(result.success).toBe(true);
    expect(lastCalledModelId()).toBe('m2');
    expect(preferencesStorage.setCalls).toHaveLength(0);
  });

  test('keeps the effective selection when no models are stored', async () => {
    const { container, preferencesStorage } = createTestContainer();
    preferencesStorage.seed(seedPreferences({ google: 'dead-model' }));
    const handler = new TranslateImageHandler(container);

    const result = await handler.handle(
      { imageBase64: VALID_IMAGE_BASE64 },
      1,
    );

    expect(result.success).toBe(true);
    expect(lastCalledModelId()).toBe('dead-model');
    expect(preferencesStorage.setCalls).toHaveLength(0);
    expect(preferencesStorage.stored?.getModelIdFor('google')).toBe(
      'dead-model',
    );
  });
});
