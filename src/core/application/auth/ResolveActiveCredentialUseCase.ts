import type { IResolveActiveCredentialUseCase } from '../../ports/inbound/auth/IResolveActiveCredentialUseCase';
import type { IKeySelectionStorage } from '../../ports/outbound/IKeySelectionStorage';
import type { Credential } from '../../domain/credential/Credential';
import type { Credentials } from '../../domain/credential/Credentials';
import { success, failure, type Result } from '../../../shared/types/Result';
import { AuthError, type AppError } from '../../../shared/errors';

export class ResolveActiveCredentialUseCase implements IResolveActiveCredentialUseCase {
  constructor(private readonly keySelectionStorage: IKeySelectionStorage) {}

  async execute(
    credentials: Credentials,
  ): Promise<Result<Credential, AppError>> {
    const modeResult = await this.keySelectionStorage.getMode();
    if (!modeResult.success) {
      return this.resolveManual(credentials);
    }

    const mode = modeResult.data;

    if (mode.isManual) {
      return this.resolveManual(credentials);
    }

    const provider = mode.autoBalanceProvider;
    if (!provider) {
      return this.resolveManual(credentials);
    }

    const providerKeys = credentials.getByProvider(provider);
    if (providerKeys.length < 2) {
      return this.resolveManual(credentials);
    }

    const lastUsedResult =
      await this.keySelectionStorage.getLastUsedId(provider);
    const lastUsedId = lastUsedResult.success ? lastUsedResult.data : null;

    const next = credentials.getNextRoundRobin(provider, lastUsedId);
    if (!next) {
      return this.resolveManual(credentials);
    }

    const rotationResult = await this.keySelectionStorage.setLastUsedId(
      provider,
      next.id,
    );
    if (!rotationResult.success) {
      // Non-fatal: the request still goes out on `next`, but without a
      // persisted cursor the rotation will hand back the same key next time.
      console.warn(
        '[ResolveActiveCredential] Could not persist round-robin cursor — rotation may repeat a key:',
        rotationResult.error,
      );
    }

    return success(next);
  }

  private resolveManual(
    credentials: Credentials,
  ): Result<Credential, AppError> {
    const active = credentials.getActive();
    if (!active) {
      return failure(AuthError.notAuthenticated());
    }
    return success(active);
  }
}
