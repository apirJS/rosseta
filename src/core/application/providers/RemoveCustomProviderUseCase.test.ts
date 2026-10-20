import { describe, expect, test, spyOn } from 'bun:test';
import { RemoveCustomProviderUseCase } from './RemoveCustomProviderUseCase';
import {
  FakeCustomProviderStorage,
  makeCustomProviderConfig,
} from '../../../../tests/fakes/FakeCustomProviderStorage';
import { FakeCredentialStorage } from '../../../../tests/fakes/FakeCredentialStorage';
import { FakeModelStorage } from '../../../../tests/fakes/FakeModelStorage';
import { FakeUserPreferencesStorage } from '../../../../tests/fakes/FakeUserPreferencesStorage';
import { FakeKeySelectionStorage } from '../../../../tests/fakes/FakeKeySelectionStorage';
import { Credential } from '../../domain/credential/Credential';
import { ApiKey } from '../../domain/credential/ApiKey';
import { Credentials } from '../../domain/credential/Credentials';
import { KeySelectionMode } from '../../domain/credential/KeySelectionMode';
import type { AnyProvider } from '../../domain/credential/Provider';
import { UserPreferences } from '../../domain/preferences/UserPreferences';
import { StorageError } from '../../../shared/errors';
import { failure } from '../../../shared/types/Result';
import { v4 as uuidv4 } from 'uuid';
import { FakeProviderMutationLock } from '../../../../tests/fakes/FakeProviderMutationLock';

function makeCredential(id: string, provider: AnyProvider): Credential {
  const apiKey = ApiKey.createWithProvider('key-value-123', provider);

  if (!apiKey.success) throw new Error('bad key');

  const cred = Credential.create(id, apiKey.data, provider);

  if (!cred.success) throw new Error('bad cred');

  return cred.data;
}

function createDeps() {
  const customProviderStorage = new FakeCustomProviderStorage([
    makeCustomProviderConfig({ id: 'custom-a', name: 'A' }),
  ]);

  const credentialStorage = new FakeCredentialStorage();
  const modelStorage = new FakeModelStorage();
  const preferencesStorage = new FakeUserPreferencesStorage();
  const keySelectionStorage = new FakeKeySelectionStorage();
  const mutationLock = new FakeProviderMutationLock();

  const useCase = new RemoveCustomProviderUseCase(
    customProviderStorage,
    credentialStorage,
    modelStorage,
    preferencesStorage,
    keySelectionStorage,
    mutationLock,
  );

  return {
    customProviderStorage,
    credentialStorage,
    modelStorage,
    preferencesStorage,
    keySelectionStorage,
    mutationLock,
    useCase,
  };
}

function seedProviderData(deps: ReturnType<typeof createDeps>) {
  deps.credentialStorage.seedWith(
    Credentials.createEmpty(uuidv4())
      .add(makeCredential('google-key', 'google'))
      .add(makeCredential('deepseek-key', 'deepseek'))
      .add(makeCredential('custom-key-1', 'custom-a'))
      .add(makeCredential('custom-key-2', 'custom-a')),
  );

  deps.modelStorage.seedModels('custom-a', [
    { id: 'manual', name: 'Manual', source: 'manual' },
    { id: 'fetched', name: 'Fetched', source: 'fetched' },
  ]);

  deps.modelStorage.seedModels('deepseek', [
    { id: 'deepseek-flash', name: 'Flash', source: 'fetched' },
  ]);

  deps.preferencesStorage.seed(
    UserPreferences.createDefault(uuidv4())
      .withSelectedModel('custom-a', 'manual')
      .withSelectedModel('deepseek', 'deepseek-flash'),
  );

  deps.keySelectionStorage.seedMode(KeySelectionMode.autoBalance('custom-a'));
  deps.keySelectionStorage.seedLastUsedId('custom-a', 'custom-key-2');
  deps.keySelectionStorage.seedLastUsedId('deepseek', 'deepseek-key');
}

describe('Application: RemoveCustomProviderUseCase', () => {
  test('does not touch provider data if mutation lock acquisition fails', async () => {
    const deps = createDeps();

    seedProviderData(deps);

    const error = StorageError.writeFailed('provider mutation lock');

    deps.mutationLock.failNext(error);

    expect(await deps.useCase.execute('custom-a')).toEqual({
      success: false,
      error,
    });

    expect(deps.modelStorage.getStoredModels('custom-a')).toHaveLength(2);

    expect(deps.preferencesStorage.stored?.selectedModels['custom-a']).toBe(
      'manual',
    );

    const configs = await deps.customProviderStorage.load();

    expect(configs.success && configs.data.map((config) => config.id)).toEqual([
      'custom-a',
    ]);

    const credentials = await deps.credentialStorage.get();

    expect(
      credentials.success && credentials.data?.getByProvider('custom-a'),
    ).toHaveLength(2);
  });

  test('removes the provider', async () => {
    const { customProviderStorage, useCase } = createDeps();

    const result = await useCase.execute('custom-a');

    expect(result.success).toBe(true);

    const stored = await customProviderStorage.load();

    if (stored.success) {
      expect(stored.data).toHaveLength(0);
    }
  });

  test('removes credentials belonging to the provider', async () => {
    const { credentialStorage, useCase } = createDeps();

    const credentials = Credentials.createEmpty(uuidv4())
      .add(makeCredential('k1', 'custom-a'))
      .add(makeCredential('k2', 'google'));

    credentialStorage.seedWith(credentials);

    const result = await useCase.execute('custom-a');

    expect(result.success).toBe(true);

    const remaining = await credentialStorage.get();

    if (remaining.success && remaining.data) {
      expect(remaining.data.items.map((c) => c.id)).toEqual(['k2']);
    }
  });

  test('clears the model list for the provider', async () => {
    const { modelStorage, useCase } = createDeps();

    modelStorage.seedModels('custom-a', [
      { id: 'm1', name: 'Model 1', source: 'manual' },
    ]);

    const result = await useCase.execute('custom-a');

    expect(result.success).toBe(true);
    expect(modelStorage.getStoredModels('custom-a')).toHaveLength(0);
  });

  test('propagates storage failures', async () => {
    const { customProviderStorage, useCase } = createDeps();

    customProviderStorage.failNext(StorageError.writeFailed('customProviders'));

    const result = await useCase.execute('custom-a');

    expect(result.success).toBe(false);
  });

  test('removes all provider data and selects an existing DeepSeek key', async () => {
    const deps = createDeps();

    seedProviderData(deps);
    expect((await deps.useCase.execute('custom-a')).success).toBe(true);

    const keys = await deps.credentialStorage.get();

    expect(keys.success && keys.data?.items.map((key) => key.id)).toEqual([
      'google-key',
      'deepseek-key',
    ]);

    expect(keys.success && keys.data?.getActive()?.provider).toBe('deepseek');

    const models = await deps.modelStorage.getAllModels();

    expect(models.success && models.data).toEqual({
      deepseek: [{ id: 'deepseek-flash', name: 'Flash', source: 'fetched' }],
    });

    expect(deps.preferencesStorage.stored?.selectedModels).toEqual({
      deepseek: 'deepseek-flash',
    });

    const mode = await deps.keySelectionStorage.getMode();

    expect(mode.success && mode.data.value).toBe('manual');

    const ids = await deps.keySelectionStorage.getAllLastUsedIds();

    expect(ids.success && ids.data).toEqual({ deepseek: 'deepseek-key' });
  });

  test('preserves another provider active key and key-selection mode', async () => {
    const deps = createDeps();

    seedProviderData(deps);

    deps.credentialStorage.seedWith(
      Credentials.createEmpty(uuidv4())
        .add(makeCredential('custom-key', 'custom-a'))
        .add(makeCredential('google-key', 'google')),
    );

    deps.keySelectionStorage.seedMode(KeySelectionMode.autoBalance('google'));

    expect((await deps.useCase.execute('custom-a')).success).toBe(true);

    const keys = await deps.credentialStorage.get();

    expect(keys.success && keys.data?.activeCredentialId).toBe('google-key');

    const mode = await deps.keySelectionStorage.getMode();

    expect(mode.success && mode.data.value).toBe('auto-balance:google');
  });

  test('clears active selection when the removed provider owns all keys', async () => {
    const deps = createDeps();

    deps.credentialStorage.seedWith(
      Credentials.createEmpty(uuidv4()).add(
        makeCredential('custom-key', 'custom-a'),
      ),
    );

    expect((await deps.useCase.execute('custom-a')).success).toBe(true);

    const keys = await deps.credentialStorage.get();

    expect(keys.success && keys.data?.activeCredentialId).toBeNull();
    expect(keys.success && keys.data?.items).toEqual([]);
  });

  test.each(['credentials', 'preferences', 'mode'] as const)(
    'a %s read failure preserves configuration and related data',
    async (stage) => {
      const deps = createDeps();

      seedProviderData(deps);

      const error = StorageError.readFailed(stage);

      if (stage === 'credentials')
        deps.credentialStorage.failNextCallWith(error);
      if (stage === 'preferences')
        deps.preferencesStorage.failNextCallWith(error);
      if (stage === 'mode') deps.keySelectionStorage.failNextCallWith(error);

      expect(await deps.useCase.execute('custom-a')).toEqual(failure(error));

      const providers = await deps.customProviderStorage.load();

      expect(
        providers.success && providers.data.map((provider) => provider.id),
      ).toEqual(['custom-a']);

      const keys = await deps.credentialStorage.get();

      expect(keys.success && keys.data?.getByProvider('custom-a')).toHaveLength(
        2,
      );

      expect(deps.modelStorage.getStoredModels('custom-a')).toHaveLength(2);
    },
  );

  test.each([
    'credentials',
    'models',
    'preferences',
    'mode',
    'last-used',
    'provider',
  ] as const)(
    'a %s write failure retains configuration for an idempotent retry',
    async (stage) => {
      const deps = createDeps();

      seedProviderData(deps);

      const error = StorageError.writeFailed(stage);

      const operation =
        stage === 'credentials'
          ? spyOn(deps.credentialStorage, 'save')
          : stage === 'models'
            ? spyOn(deps.modelStorage, 'clearModels')
            : stage === 'preferences'
              ? spyOn(deps.preferencesStorage, 'set')
              : stage === 'mode'
                ? spyOn(deps.keySelectionStorage, 'setMode')
                : stage === 'last-used'
                  ? spyOn(deps.keySelectionStorage, 'clearLastUsedId')
                  : spyOn(deps.customProviderStorage, 'remove');

      operation.mockResolvedValueOnce(failure(error));

      try {
        expect(await deps.useCase.execute('custom-a')).toEqual(failure(error));

        const providers = await deps.customProviderStorage.load();

        expect(providers.success && providers.data).toHaveLength(1);
        expect((await deps.useCase.execute('custom-a')).success).toBe(true);

        const keys = await deps.credentialStorage.get();

        expect(keys.success && keys.data?.getByProvider('custom-a')).toEqual(
          [],
        );

        expect(deps.modelStorage.getStoredModels('custom-a')).toEqual([]);

        expect(deps.preferencesStorage.stored?.selectedModels).toEqual({
          deepseek: 'deepseek-flash',
        });
      } finally {
        operation.mockRestore();
      }
    },
  );

  test('repairs related data when the custom configuration was already removed', async () => {
    const deps = createDeps();

    seedProviderData(deps);
    await deps.customProviderStorage.remove('custom-a');
    expect((await deps.useCase.execute('custom-a')).success).toBe(true);

    const keys = await deps.credentialStorage.get();

    expect(keys.success && keys.data?.getByProvider('custom-a')).toEqual([]);
    expect(deps.modelStorage.getStoredModels('custom-a')).toEqual([]);
  });

  test('rejects built-in provider deletion before changing any data', async () => {
    const deps = createDeps();

    seedProviderData(deps);
    expect((await deps.useCase.execute('deepseek')).success).toBe(false);

    const keys = await deps.credentialStorage.get();

    expect(keys.success && keys.data?.getByProvider('deepseek')).toHaveLength(
      1,
    );

    expect(deps.modelStorage.getStoredModels('deepseek')).toHaveLength(1);
  });
});
