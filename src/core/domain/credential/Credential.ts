import { AggregateRoot } from '../shared/AggregateRoot';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';
import { ApiKey } from './ApiKey';
import type { Provider } from './Provider';

export interface CredentialProps {
  id: string;
  type: 'API_KEY';
  provider: Provider;
  apiKey: string;
}

export class Credential extends AggregateRoot<string> {
  private constructor(
    id: string,
    private readonly _apiKey: ApiKey,
    private readonly _provider: Provider,
  ) {
    super(id);
  }

  static create(
    id: string,
    apiKey: ApiKey,
    provider: Provider,
  ): Result<Credential, DomainError> {
    if (!id || id.trim().length === 0) {
      return failure(new DomainError('Credential ID cannot be empty'));
    }
    return success(new Credential(id, apiKey, provider));
  }

  static fromProps(props: CredentialProps): Result<Credential, DomainError> {
    if (!props.id) {
      return failure(new DomainError('Credential ID is missing'));
    }

    const apiKeyResult = ApiKey.create(props.apiKey);
    if (!apiKeyResult.success) return failure(apiKeyResult.error);
    return this.create(props.id, apiKeyResult.data, props.provider);
  }

  get type(): 'API_KEY' {
    return 'API_KEY';
  }

  get provider(): Provider {
    return this._provider;
  }

  get apiKey(): ApiKey {
    return this._apiKey;
  }

  toProps(): CredentialProps {
    return {
      id: this.id,
      type: 'API_KEY',
      provider: this._provider,
      apiKey: this._apiKey.value,
    };
  }
}
