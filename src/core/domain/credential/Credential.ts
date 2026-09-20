import { Entity } from '../shared/Entity';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';
import { ApiKey } from './ApiKey';
import type { AnyProvider } from './Provider';

export interface CredentialProps {
  id: string;
  type: 'API_KEY';
  provider: AnyProvider;
  apiKey: string;
}

export class Credential extends Entity<string> {
  private constructor(
    id: string,
    private readonly apiKeyValue: ApiKey,
    private readonly providerValue: AnyProvider,
  ) {
    super(id);
  }

  static create(
    id: string,
    apiKey: ApiKey,
    provider: AnyProvider,
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

    const apiKeyResult = ApiKey.fromRaw(props.apiKey, props.provider);
    if (!apiKeyResult.success) return failure(apiKeyResult.error);
    return this.create(props.id, apiKeyResult.data, props.provider);
  }

  get type(): 'API_KEY' {
    return 'API_KEY';
  }

  get provider(): AnyProvider {
    return this.providerValue;
  }

  get apiKey(): ApiKey {
    return this.apiKeyValue;
  }

  toProps(): CredentialProps {
    return {
      id: this.id,
      type: 'API_KEY',
      provider: this.providerValue,
      apiKey: this.apiKeyValue.value,
    };
  }
}
