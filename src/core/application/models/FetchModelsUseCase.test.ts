import { describe, expect, test, beforeEach } from 'bun:test';
import { FetchModelsUseCase } from './FetchModelsUseCase';
import { FakeModelStorage } from '../../../../tests/fakes/FakeModelStorage';
import { FakeModelFetchService } from '../../../../tests/fakes/FakeModelFetchService';
import { ProviderRegistry } from '../../domain/provider/ProviderRegistry';
import { StorageError, NetworkError, AuthError, ErrorCode } from '../../../shared/errors';

describe('Application: FetchModelsUseCase', () => {
  let storage: FakeModelStorage;
  let fetchService: FakeModelFetchService;

  beforeEach(() => {
    storage = new FakeModelStorage();
    fetchService = new FakeModelFetchService();
    ProviderRegistry.setModels('google', []);
  });

  test('fetches models, persists, and updates the registry', async () => {
    fetchService.seedModels('google', [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ]);

    const useCase = new FetchModelsUseCase(storage, fetchService);
    const result = await useCase.execute('google', 'AIzaKey');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].source).toBe('fetched');
    }
    expect(storage.getStoredModels('google')).toHaveLength(2);
    expect(ProviderRegistry.getModelsForProvider('google')).toHaveLength(2);
  });

  test('merges fetched models with manual models, manual wins on ID conflict', async () => {
    storage.seedModels('google', [
      { id: 'shared-model', name: 'My Custom Name', source: 'manual' },
    ]);
    fetchService.seedModels('google', [
      { id: 'shared-model', name: 'API Name' },
      { id: 'new-model', name: 'New Model' },
    ]);

    const useCase = new FetchModelsUseCase(storage, fetchService);
    const result = await useCase.execute('google', 'AIzaKey');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      const shared = result.data.find((m) => m.id === 'shared-model');
      expect(shared?.source).toBe('manual');
      expect(shared?.name).toBe('My Custom Name');
    }
  });

  test('returns failure when the fetch service fails', async () => {
    fetchService.seedError('google', AuthError.invalidApiKey());

    const useCase = new FetchModelsUseCase(storage, fetchService);
    const result = await useCase.execute('google', 'bad-key');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
    }
    expect(storage.getStoredModels('google')).toHaveLength(0);
  });

  test('returns failure for providers without a fetcher', async () => {
    fetchService.setFetchable([]);

    const useCase = new FetchModelsUseCase(storage, fetchService);
    const result = await useCase.execute('google', 'AIzaKey');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.VALIDATION_INVALID_INPUT);
    }
  });

  test('returns failure when persisting fails', async () => {
    fetchService.seedModels('google', [{ id: 'm1', name: 'M1' }]);
    storage.failNextCallWith(StorageError.writeFailed('models:google'));

    const useCase = new FetchModelsUseCase(storage, fetchService);
    const result = await useCase.execute('google', 'AIzaKey');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    }
  });

  test('propagates network error classification', async () => {
    fetchService.seedError(
      'google',
      NetworkError.serverError(503, 'https://api.test'),
    );

    const useCase = new FetchModelsUseCase(storage, fetchService);
    const result = await useCase.execute('google', 'AIzaKey');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NetworkError);
    }
  });
});
