import type { ISetKeySelectionModeUseCase } from '../../ports/inbound/auth/ISetKeySelectionModeUseCase';
import type { IKeySelectionStorage } from '../../ports/outbound/IKeySelectionStorage';
import type { ICredentialStorage } from '../../ports/outbound/ICredentialStorage';
import type { KeySelectionMode } from '../../domain/credential/KeySelectionMode';
import { success, failure, type Result } from '../../../shared/types/Result';
import { AuthError, type AppError } from '../../../shared/errors';

export class SetKeySelectionModeUseCase implements ISetKeySelectionModeUseCase {
  constructor(
    private readonly keySelectionStorage: IKeySelectionStorage,
    private readonly credentialStorage: ICredentialStorage,
  ) {}

  async execute(mode: KeySelectionMode): Promise<Result<void, AppError>> {
    // Manual mode is always valid
    if (mode.isManual) {
      return this.keySelectionStorage.setMode(mode);
    }

    // For auto-balance, verify the provider has ≥ 2 keys
    const provider = mode.autoBalanceProvider;
    if (!provider) {
      return failure(AuthError.invalidApiKey('Invalid auto-balance provider'));
    }

    const credsResult = await this.credentialStorage.get();
    if (!credsResult.success) return failure(credsResult.error);

    const credentials = credsResult.data;
    if (!credentials) {
      return failure(
        AuthError.invalidApiKey(
          'No credentials found. Add at least 2 keys to enable auto-balance.',
        ),
      );
    }

    const providerKeys = credentials.getByProvider(provider);
    if (providerKeys.length < 2) {
      return failure(
        AuthError.invalidApiKey(
          `Need at least 2 ${provider} keys to enable auto-balance. Found ${providerKeys.length}.`,
        ),
      );
    }

    return this.keySelectionStorage.setMode(mode);
  }
}
