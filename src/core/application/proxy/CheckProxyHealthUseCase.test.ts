import { describe, expect, test } from 'bun:test';
import { CheckProxyHealthUseCase } from './CheckProxyHealthUseCase';
import { FakeProxyHealthChecker } from '../../../../tests/fakes/FakeProxyHealthChecker';
import { BrowserError } from '../../../shared/errors';

describe('UseCase: CheckProxyHealthUseCase', () => {
  function createUseCase() {
    const checker = new FakeProxyHealthChecker();
    const useCase = new CheckProxyHealthUseCase(checker);
    return { useCase, checker };
  }

  test('returns success(true) when proxy is reachable', async () => {
    const { useCase, checker } = createUseCase();
    checker.setHealthy(true);

    const result = await useCase.execute('https://proxy.example.com');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(true);
    }
  });

  test('returns success(false) when proxy is unreachable', async () => {
    const { useCase, checker } = createUseCase();
    checker.setHealthy(false);

    const result = await useCase.execute('https://proxy.example.com');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(false);
    }
  });

  test('returns failure when health checker throws', async () => {
    const { useCase, checker } = createUseCase();
    const error = BrowserError.communicationFailed(new Error('timeout'));
    checker.failNextCallWith(error);

    const result = await useCase.execute('https://proxy.example.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('communicate');
    }
  });
});
