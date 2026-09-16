import type { ICustomProviderStorage } from '../../src/core/ports/outbound/ICustomProviderStorage';
import type {
  CustomProviderConfig,
  CustomProviderConfigProps,
} from '../../src/core/domain/provider/CustomProviderConfig';
import { CustomProviderConfig as Config } from '../../src/core/domain/provider/CustomProviderConfig';
import { success, failure, type Result } from '../../src/shared/types/Result';
import type { AppError } from '../../src/shared/errors';
import { StorageError } from '../../src/shared/errors';

export class FakeCustomProviderStorage implements ICustomProviderStorage {
  private providers: CustomProviderConfig[] = [];
  private _failNext: AppError | null = null;

  constructor(initial: CustomProviderConfig[] = []) {
    this.providers = initial;
  }

  failNext(error: AppError): void {
    this._failNext = error;
  }

  private checkFailure(): AppError | null {
    if (this._failNext) {
      const err = this._failNext;
      this._failNext = null;
      return err;
    }
    return null;
  }

  async load(): Promise<Result<CustomProviderConfig[], AppError>> {
    const err = this.checkFailure();
    if (err) return failure(err);
    return success([...this.providers]);
  }

  async save(
    config: CustomProviderConfig,
  ): Promise<Result<void, AppError>> {
    const err = this.checkFailure();
    if (err) return failure(err);

    const index = this.providers.findIndex((p) => p.id === config.id);
    if (index >= 0) {
      this.providers[index] = config;
    } else {
      this.providers.push(config);
    }
    return success(undefined);
  }

  async remove(id: string): Promise<Result<void, AppError>> {
    const err = this.checkFailure();
    if (err) return failure(err);

    this.providers = this.providers.filter((p) => p.id !== id);
    return success(undefined);
  }
}

export function makeCustomProviderConfig(
  overrides: Partial<CustomProviderConfigProps> = {},
): CustomProviderConfig {
  const result = Config.create({
    id: overrides.id ?? 'custom-fake-1',
    name: overrides.name ?? 'Fake Provider',
    baseURL: overrides.baseURL ?? 'https://api.fake.com/v1',
    headers: overrides.headers,
    queryParams: overrides.queryParams,
  });
  if (!result.success) throw result.error;
  return result.data;
}

export { StorageError };
