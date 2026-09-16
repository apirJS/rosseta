import { describe, expect, test } from 'bun:test';
import { SaveCustomProviderUseCase } from './SaveCustomProviderUseCase';
import {
  FakeCustomProviderStorage,
  makeCustomProviderConfig,
} from '../../../../tests/fakes/FakeCustomProviderStorage';
import { StorageError } from '../../../shared/errors';

describe('Application: SaveCustomProviderUseCase', () => {
  test('generates a custom- id for new providers', async () => {
    const storage = new FakeCustomProviderStorage();
    const useCase = new SaveCustomProviderUseCase(storage);

    const result = await useCase.execute({
      id: '',
      name: 'OpenRouter',
      baseURL: 'https://openrouter.ai/api/v1',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id.startsWith('custom-')).toBe(true);

      const snapshot = await storage.load();
      if (snapshot.success) {
        expect(snapshot.data).toHaveLength(1);
      }
    }
  });

  test('updates an existing provider by id', async () => {
    const existing = makeCustomProviderConfig({ name: 'Old Name' });
    const storage = new FakeCustomProviderStorage([existing]);
    const useCase = new SaveCustomProviderUseCase(storage);

    const result = await useCase.execute({
      id: 'custom-fake-1',
      name: 'New Name',
      baseURL: 'https://api.fake.com/v2',
    });

    expect(result.success).toBe(true);
    const snapshot = await storage.load();
    if (snapshot.success) {
      expect(snapshot.data).toHaveLength(1);
      expect(snapshot.data[0].name).toBe('New Name');
      expect(snapshot.data[0].baseURL).toBe(
        'https://api.fake.com/v2',
      );
    }
  });

  test('fails validation for a bad base URL', async () => {
    const storage = new FakeCustomProviderStorage();
    const useCase = new SaveCustomProviderUseCase(storage);

    const result = await useCase.execute({
      id: '',
      name: 'Broken',
      baseURL: 'not-a-url',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('http');
    }
  });

  test('propagates storage failures', async () => {
    const storage = new FakeCustomProviderStorage();
    storage.failNext(StorageError.writeFailed('customProviders'));
    const useCase = new SaveCustomProviderUseCase(storage);

    const result = await useCase.execute({
      id: '',
      name: 'OpenRouter',
      baseURL: 'https://openrouter.ai/api/v1',
    });

    expect(result.success).toBe(false);
  });
});
