import { describe, expect, test } from 'bun:test';
import { TranslationRequestPreparer } from './TranslationRequestPreparer';
import { FakeCredentialStorage } from '../../../../../tests/fakes/FakeCredentialStorage';
import { FakeKeySelectionStorage } from '../../../../../tests/fakes/FakeKeySelectionStorage';
import { FakeUserPreferencesStorage } from '../../../../../tests/fakes/FakeUserPreferencesStorage';
import { FakeModelStorage } from '../../../../../tests/fakes/FakeModelStorage';
import { FakeTranslationCapabilityStorage } from '../../../../../tests/fakes/FakeTranslationCapabilityStorage';
import { GetCredentialsUseCase } from '../../../../core/application/auth/GetCredentialUseCase';
import { ResolveActiveCredentialUseCase } from '../../../../core/application/auth/ResolveActiveCredentialUseCase';
import { GetPreferencesUseCase } from '../../../../core/application/preferences/GetPreferencesUseCase';
import { UpdatePreferencesUseCase } from '../../../../core/application/preferences/UpdatePreferencesUseCase';
import { LoadModelsUseCase } from '../../../../core/application/models/LoadModelsUseCase';
import { Credentials } from '../../../../core/domain/credential/Credentials';
import { UserPreferences } from '../../../../core/domain/preferences/UserPreferences';
import { createGoogleCredential } from '../../../../../tests/test-fixtures';
import type { Container } from '../../../../shared/di/container-factory';
import { ErrorCode, StorageError } from '../../../../shared/errors';

function preferences(selectedModels: Record<string, string>): UserPreferences {
  const value = UserPreferences.fromRaw({
    id: 'preferences',
    targetLanguage: 'en-US',
    selectedModels,
    theme: 'system',
  });
  if (!value.success) throw value.error;
  return value.data;
}

function fixture() {
  const credentials = new FakeCredentialStorage();
  credentials.seedWith(
    Credentials.createEmpty('credentials').add(createGoogleCredential()),
  );
  const preferenceStorage = new FakeUserPreferencesStorage();
  const models = new FakeModelStorage();
  const container = {
    getCredentialsUseCase: new GetCredentialsUseCase(credentials),
    resolveActiveCredentialUseCase: new ResolveActiveCredentialUseCase(
      new FakeKeySelectionStorage(),
    ),
    getPreferencesUseCase: new GetPreferencesUseCase(preferenceStorage),
    updatePreferencesUseCase: new UpdatePreferencesUseCase(preferenceStorage),
    loadModelsUseCase: new LoadModelsUseCase(models),
    translationCapabilityStorage: new FakeTranslationCapabilityStorage(),
  } as unknown as Container;
  return {
    credentials,
    preferenceStorage,
    models,
    preparer: new TranslationRequestPreparer(container),
  };
}

describe('Service: TranslationRequestPreparer', () => {
  test('repairs a stale model to the registry default or first available model and preserves other providers', async () => {
    const { preparer, preferenceStorage, models } = fixture();
    preferenceStorage.seed(
      preferences({ google: 'dead-model', groq: 'llama-4' }),
    );
    models.seedModels('google', [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', source: 'fetched' },
      { id: 'other-model', name: 'Other', source: 'fetched' },
    ]);
    expect((await preparer.prepare()).success).toBe(true);
    expect(preferenceStorage.stored?.getModelIdFor('google')).toBe(
      'gemini-2.5-flash',
    );
    expect(preferenceStorage.stored?.getModelIdFor('groq')).toBe('llama-4');
    expect(preferenceStorage.setCalls).toHaveLength(1);
  });

  test('repairs to the first stored model when the default is absent too', async () => {
    const { preparer, preferenceStorage, models } = fixture();
    preferenceStorage.seed(preferences({ google: 'dead-model' }));
    models.seedModels('google', [
      { id: 'm1', name: 'Model 1', source: 'fetched' },
      { id: 'm2', name: 'Model 2', source: 'fetched' },
    ]);
    expect((await preparer.prepare()).success).toBe(true);
    expect(preferenceStorage.stored?.getModelIdFor('google')).toBe('m1');
  });

  test('does not rewrite preferences when the selected model is valid', async () => {
    const { preparer, preferenceStorage, models } = fixture();
    preferenceStorage.seed(preferences({ google: 'm2' }));
    models.seedModels('google', [
      { id: 'm1', name: 'Model 1', source: 'fetched' },
      { id: 'm2', name: 'Model 2', source: 'fetched' },
    ]);
    const result = await preparer.prepare();
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.targetLanguage).toEqual({
        code: 'en-US',
        name: 'English',
      });
    expect(preferenceStorage.setCalls).toHaveLength(0);
    expect(preferenceStorage.stored?.getModelIdFor('google')).toBe('m2');
  });

  test('keeps the effective selected model when the model list is empty', async () => {
    const { preparer, preferenceStorage } = fixture();
    preferenceStorage.seed(preferences({ google: 'dead-model' }));
    expect((await preparer.prepare()).success).toBe(true);
    expect(preferenceStorage.stored?.getModelIdFor('google')).toBe(
      'dead-model',
    );
    expect(preferenceStorage.setCalls).toHaveLength(0);
  });

  test('failed preference repair persistence does not prevent using the repaired model', async () => {
    const { preparer, preferenceStorage, models } = fixture();
    preferenceStorage.seed(preferences({ google: 'dead-model' }));
    preferenceStorage.failNextSetWith(StorageError.writeFailed('preferences'));
    models.seedModels('google', [
      { id: 'available', name: 'Available', source: 'fetched' },
    ]);
    expect((await preparer.prepare()).success).toBe(true);
  });

  test('credential storage errors are preserved without attempting generation', async () => {
    const { preparer, credentials } = fixture();
    const error = StorageError.readFailed('credentials');
    credentials.failNextCallWith(error);
    expect(await preparer.prepare()).toEqual({ success: false, error });
  });

  test('missing credentials produce the existing authentication failure', async () => {
    const { preferenceStorage, models } = fixture();
    const container = {
      getCredentialsUseCase: new GetCredentialsUseCase(
        new FakeCredentialStorage(),
      ),
      getPreferencesUseCase: new GetPreferencesUseCase(preferenceStorage),
      loadModelsUseCase: new LoadModelsUseCase(models),
    } as unknown as Container;
    const result = await new TranslationRequestPreparer(container).prepare();
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.AUTH_NOT_AUTHENTICATED);
  });

  test('an empty model selection with no catalog produces the existing configuration failure', async () => {
    const { preparer, preferenceStorage } = fixture();
    preferenceStorage.seed(preferences({}).withSelectedModel('google', ''));
    const result = await preparer.prepare();
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe(ErrorCode.VALIDATION_INVALID_INPUT);
  });
});
