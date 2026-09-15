import { describe, expect, test } from 'bun:test';
import { GetCustomProvidersUseCase } from './GetCustomProvidersUseCase';
import {
  FakeCustomProviderStorage,
  makeCustomProviderConfig,
} from '../../../../tests/fakes/FakeCustomProviderStorage';
import { StorageError } from '../../../shared/errors';

describe('Application: GetCustomProvidersUseCase', () => {
  test('returns the stored providers', async () => {
    const provider = makeCustomProviderConfig();
    const storage = new FakeCustomProviderStorage([provider]);
    const useCase = new GetCustomProvidersUseCase(storage);

    const result = await useCase.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('custom-fake-1');
    }
  });

  test('propagates storage failures', async () => {
    const storage = new FakeCustomProviderStorage();
    storage.failNext(StorageError.readFailed('customProviders'));
    const useCase = new GetCustomProvidersUseCase(storage);

    const result = await useCase.execute();

    expect(result.success).toBe(false);
  });
});
