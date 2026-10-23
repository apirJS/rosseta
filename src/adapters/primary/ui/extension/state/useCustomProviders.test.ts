import { afterEach, describe, expect, test, vi } from 'vitest';
import { useCustomProviders } from './useCustomProviders.svelte';
import { CustomProviderConfig } from '../../../../../core/domain/provider/CustomProviderConfig';
import { success, failure } from '../../../../../shared/types/Result';
import { StorageError } from '../../../../../shared/errors';
import type { CustomProviderUseCases } from '../context/providers';

const { getCustomProvidersContext } = vi.hoisted(() => ({
  getCustomProvidersContext: vi.fn(),
}));

vi.mock('../context', () => ({ getCustomProvidersContext }));

function createUseCases() {
  const config = CustomProviderConfig.create({
    id: 'custom-deepseek',
    name: 'Old DeepSeek',
    baseURL: 'https://api.deepseek.com',
  });

  if (!config.success) throw new Error('Invalid test provider');

  const getProviders = vi.fn().mockResolvedValue(success([config.data]));
  const remove = vi.fn().mockResolvedValue(success(undefined));

  const useCases: CustomProviderUseCases = {
    getCustomProviders: { execute: getProviders },
    saveCustomProvider: { execute: vi.fn() },
    removeCustomProvider: { execute: remove },
  };

  getCustomProvidersContext.mockReturnValue(useCases);

  return { getProviders, remove };
}

describe('UI Hook: useCustomProviders', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('removes a deleted provider from the popup snapshot without requiring another storage read', async () => {
    const { getProviders } = createUseCases();
    const providers = useCustomProviders();

    await providers.hydrate();

    expect(providers.options).toContainEqual({
      value: 'deepseek',
      label: 'DeepSeek',
    });

    expect(providers.options).toContainEqual({
      value: 'custom-deepseek',
      label: 'Old DeepSeek',
    });

    getProviders.mockResolvedValue(
      failure(StorageError.readFailed('customProviders')),
    );

    const result = await providers.remove('custom-deepseek');

    expect(result.success).toBe(true);
    expect(providers.state.providers).toEqual([]);
    expect(providers.getProvider('custom-deepseek')).toBeNull();

    expect(
      providers.options.some((option) => option.value === 'custom-deepseek'),
    ).toBe(false);

    expect(getProviders).toHaveBeenCalledOnce();
  });

  test('preserves the valid popup provider when its removal fails', async () => {
    const { remove } = createUseCases();
    const providers = useCustomProviders();

    await providers.hydrate();

    remove.mockResolvedValue(
      failure(StorageError.writeFailed('customProviders')),
    );

    const result = await providers.remove('custom-deepseek');

    expect(result.success).toBe(false);
    expect(providers.getProvider('custom-deepseek')?.name).toBe('Old DeepSeek');
  });

  test('does not fetch during construction and ignores a read completed after disposal', async () => {
    const { getProviders } = createUseCases();
    const providers = useCustomProviders();

    expect(getProviders).not.toHaveBeenCalled();

    const pending = providers.hydrate();

    providers.dispose();
    await pending;
    expect(providers.state.hydrated).toBe(false);
    expect(providers.state.providers).toEqual([]);
  });

  test('retains hydration failure for an explicit retry', async () => {
    const { getProviders } = createUseCases();

    getProviders.mockResolvedValueOnce(
      failure(StorageError.readFailed('customProviders')),
    );

    const providers = useCustomProviders();

    expect((await providers.hydrate()).success).toBe(false);
    expect(providers.state.hydrationError).toBeTruthy();
    expect((await providers.hydrate()).success).toBe(true);
    expect(providers.state.hydrationError).toBeNull();
  });
});
