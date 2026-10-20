import { beforeEach, describe, expect, test } from 'bun:test';
import { ResolveTranslationConfigurationUseCase } from './ResolveTranslationConfigurationUseCase';
import { ResolveActiveCredentialUseCase } from '../credentials/ResolveActiveCredentialUseCase';
import { FakeCredentialStorage } from '../../../../tests/fakes/FakeCredentialStorage';
import { FakeUserPreferencesStorage } from '../../../../tests/fakes/FakeUserPreferencesStorage';
import { FakeModelStorage } from '../../../../tests/fakes/FakeModelStorage';
import {
  FakeCustomProviderStorage,
  makeCustomProviderConfig,
} from '../../../../tests/fakes/FakeCustomProviderStorage';
import { FakeKeySelectionStorage } from '../../../../tests/fakes/FakeKeySelectionStorage';
import { Credentials } from '../../domain/credential/Credentials';
import { Credential } from '../../domain/credential/Credential';
import { ApiKey } from '../../domain/credential/ApiKey';
import { UserPreferences } from '../../domain/preferences/UserPreferences';
import { KeySelectionMode } from '../../domain/credential/KeySelectionMode';
import type { AnyProvider } from '../../domain/credential/Provider';
import { ErrorCode, StorageError } from '../../../shared/errors';

function credential(provider: AnyProvider, id = 'key'): Credential {
  const key = ApiKey.createWithProvider('synthetic-key', provider);

  if (!key.success) throw key.error;

  const result = Credential.create(id, key.data, provider);

  if (!result.success) throw result.error;

  return result.data;
}

describe('Application: ResolveTranslationConfigurationUseCase', () => {
  let credentialStorage: FakeCredentialStorage;
  let preferencesStorage: FakeUserPreferencesStorage;
  let modelStorage: FakeModelStorage;
  let customProviderStorage: FakeCustomProviderStorage;
  let keySelectionStorage: FakeKeySelectionStorage;

  function createAction() {
    return new ResolveTranslationConfigurationUseCase({
      credentialStorage,
      preferencesStorage,
      modelStorage,
      customProviderStorage,
      resolveActiveCredential: new ResolveActiveCredentialUseCase(
        keySelectionStorage,
      ),
      createId: () => 'preferences',
    });
  }

  beforeEach(() => {
    credentialStorage = new FakeCredentialStorage();
    preferencesStorage = new FakeUserPreferencesStorage();
    modelStorage = new FakeModelStorage();
    customProviderStorage = new FakeCustomProviderStorage();
    keySelectionStorage = new FakeKeySelectionStorage();

    credentialStorage.seedWith(
      Credentials.createEmpty('credentials').add(credential('google')),
    );
  });

  test('returns one explicit default request snapshot without a model catalog', async () => {
    const result = await createAction().execute();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.credential.provider).toBe('google');
    expect(result.data.modelId).toBe('gemini-2.5-flash');
    expect(result.data.targetLanguage.code).toBe('en-US');
    expect(result.data.includeDescription).toBe(true);
    expect(result.data.customProvider).toBeUndefined();
    expect(preferencesStorage.setCalls).toHaveLength(0);
  });

  test('uses an available replacement even if retaining selection fails', async () => {
    preferencesStorage.seed(
      UserPreferences.createDefault('prefs').withSelectedModel(
        'google',
        'stale',
      ),
    );

    modelStorage.seedModels('google', [
      { id: 'replacement', name: 'Replacement', source: 'manual' },
    ]);

    preferencesStorage.failNextSetWith(
      StorageError.writeFailed('userPreferences'),
    );

    const result = await createAction().execute();

    expect(result.success && result.data.modelId).toBe('replacement');
    expect(preferencesStorage.stored?.selectedModels.google).toBe('stale');
  });

  test('retains a saved model after an unavailable catalog read', async () => {
    preferencesStorage.seed(
      UserPreferences.createDefault('prefs').withSelectedModel(
        'google',
        'saved-model',
      ),
    );

    modelStorage.failNextCallWith(StorageError.readFailed('models:google'));

    const result = await createAction().execute();

    expect(result.success && result.data.modelId).toBe('saved-model');
  });

  test('repairs only the selected provider and captures description/language preferences', async () => {
    preferencesStorage.seed(
      UserPreferences.createDefault('prefs')
        .withSelectedModel('google', 'stale')
        .withSelectedModel('groq', 'untouched')
        .withIncludeDescription(false),
    );

    modelStorage.seedModels('google', [
      { id: 'replacement', name: 'Replacement', source: 'manual' },
    ]);

    const result = await createAction().execute();

    expect(result.success && result.data.includeDescription).toBe(false);

    expect(preferencesStorage.stored?.selectedModels).toEqual({
      google: 'replacement',
      groq: 'untouched',
    });
  });

  test('returns an authentication error when no credentials exist', async () => {
    credentialStorage = new FakeCredentialStorage();

    const result = await createAction().execute();

    expect(!result.success && result.error.code).toBe(
      ErrorCode.AUTH_NOT_AUTHENTICATED,
    );
  });

  test('propagates required configuration storage failure', async () => {
    preferencesStorage.failNextCallWith(
      StorageError.readFailed('userPreferences'),
    );

    const result = await createAction().execute();

    expect(!result.success && result.error.code).toBe(
      ErrorCode.STORAGE_READ_FAILED,
    );
  });

  test('requires a model for a custom endpoint with no default', async () => {
    credentialStorage.seedWith(
      Credentials.createEmpty('credentials').add(credential('custom-endpoint')),
    );

    const result = await createAction().execute();

    expect(!result.success && result.error.userMessage).toContain(
      'No model selected',
    );
  });

  test('loads custom endpoint settings into the request snapshot', async () => {
    credentialStorage.seedWith(
      Credentials.createEmpty('credentials').add(credential('custom-endpoint')),
    );

    preferencesStorage.seed(
      UserPreferences.createDefault('prefs').withSelectedModel(
        'custom-endpoint',
        'vision-model',
      ),
    );

    const config = makeCustomProviderConfig({
      id: 'custom-endpoint',
      headers: { 'X-Test': 'value' },
    });

    await customProviderStorage.save(config);

    const result = await createAction().execute();

    expect(result.success && result.data.customProvider).toBe(config);
  });

  test('rejects a removed custom endpoint before provider construction', async () => {
    credentialStorage.seedWith(
      Credentials.createEmpty('credentials').add(credential('custom-endpoint')),
    );

    preferencesStorage.seed(
      UserPreferences.createDefault('prefs').withSelectedModel(
        'custom-endpoint',
        'vision-model',
      ),
    );

    const result = await createAction().execute();

    expect(!result.success && result.error.userMessage).toContain(
      'Custom provider is not configured',
    );
  });

  test('advances round-robin selection once for each configuration resolution', async () => {
    const first = credential('google', 'first');
    const second = credential('google', 'second');

    credentialStorage.seedWith(
      Credentials.createEmpty('credentials').add(first).add(second),
    );

    await keySelectionStorage.setMode(KeySelectionMode.autoBalance('google'));

    const action = createAction();
    const firstResult = await action.execute();
    const secondResult = await action.execute();

    expect(firstResult.success && firstResult.data.credential.id).toBe('first');

    expect(secondResult.success && secondResult.data.credential.id).toBe(
      'second',
    );
  });
});
