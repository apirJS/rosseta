import { afterEach, describe, expect, test, vi } from 'vitest';
import { useCustomProviders } from './useCustomProviders.svelte';
import { CustomProviderConfig } from '../../../../../core/domain/provider/CustomProviderConfig';
import { ProviderRegistry } from '../../../../../core/domain/provider/ProviderRegistry';
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
    ProviderRegistry.syncCustomProviders([]);
    vi.clearAllMocks();
  });

  test('removes a deleted provider from the popup and registry without requiring another storage read', async () => {
    const { getProviders } = createUseCases();
    const providers = useCustomProviders();
    await vi.waitFor(() => expect(providers.state.hydrated).toBe(true));
    getProviders.mockResolvedValue(failure(StorageError.readFailed('customProviders')));

    const result = await providers.remove('custom-deepseek');

    expect(result.success).toBe(true);
    expect(providers.state.providers).toEqual([]);
    expect(providers.getProvider('custom-deepseek')).toBeNull();
    expect(ProviderRegistry.hasProvider('custom-deepseek')).toBe(false);
    expect(getProviders).toHaveBeenCalledOnce();
  });

  test('preserves the valid popup provider when its removal fails', async () => {
    const { remove } = createUseCases();
    const providers = useCustomProviders();
    await vi.waitFor(() => expect(providers.state.hydrated).toBe(true));
    remove.mockResolvedValue(failure(StorageError.writeFailed('customProviders')));

    const result = await providers.remove('custom-deepseek');

    expect(result.success).toBe(false);
    expect(providers.getProvider('custom-deepseek')?.name).toBe('Old DeepSeek');
    expect(ProviderRegistry.hasProvider('custom-deepseek')).toBe(true);
  });
});
