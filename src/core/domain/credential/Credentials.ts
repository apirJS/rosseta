import { AggregateRoot } from '../shared/AggregateRoot';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';
import { Credential, type CredentialProps } from './Credential';

export interface CredentialsProps {
  id: string;
  activeCredentialId: string | null;
  items: CredentialProps[];
}

export class Credentials extends AggregateRoot<string> {
  private constructor(
    id: string,
    private credentialItems: Credential[],
    private activeCredentialIdValue: string | null,
  ) {
    super(id);
  }

  static createEmpty(id: string): Credentials {
    return new Credentials(id, [], null);
  }

  static fromProps(props: CredentialsProps): Result<Credentials, DomainError> {
    if (!props.id) {
      return failure(new DomainError('Credentials ID is missing'));
    }

    const items: Credential[] = [];
    for (const itemProps of props.items) {
      const result = Credential.fromProps(itemProps);
      if (!result.success) return failure(result.error);
      items.push(result.data);
    }

    const activeId = props.activeCredentialId;
    if (activeId && !items.some((c) => c.id === activeId)) {
      return failure(
        new DomainError('Active credential ID not found in items'),
      );
    }

    return success(new Credentials(props.id, items, activeId));
  }

  get items(): readonly Credential[] {
    return this.credentialItems;
  }

  get activeCredentialId(): string | null {
    return this.activeCredentialIdValue;
  }

  hasKeys(): boolean {
    return this.credentialItems.length > 0;
  }

  getActive(): Credential | null {
    if (!this.activeCredentialIdValue) return null;
    return this.credentialItems.find((c) => c.id === this.activeCredentialIdValue) ?? null;
  }

  add(credential: Credential): Credentials {
    const filtered = this.credentialItems.filter((c) => c.id !== credential.id);
    const newItems = [...filtered, credential];
    const activeId = credential.id;
    return new Credentials(this.id, newItems, activeId);
  }

  remove(credentialId: string): Credentials {
    const newItems = this.credentialItems.filter((c) => c.id !== credentialId);
    let activeId = this.activeCredentialIdValue;

    if (activeId === credentialId) {
      activeId = newItems.length > 0 ? newItems[0].id : null;
    }

    return new Credentials(this.id, newItems, activeId);
  }

  setActive(credentialId: string): Result<Credentials, DomainError> {
    const exists = this.credentialItems.some((c) => c.id === credentialId);
    if (!exists) {
      return failure(new DomainError('Credential not found'));
    }
    return success(new Credentials(this.id, [...this.credentialItems], credentialId));
  }

  getByProvider(provider: string): Credential[] {
    return this.credentialItems.filter((c) => c.provider === provider);
  }

  getNextRoundRobin(
    provider: string,
    lastUsedId: string | null,
  ): Credential | null {
    const providerKeys = this.getByProvider(provider);
    if (providerKeys.length === 0) return null;

    if (!lastUsedId) return providerKeys[0];

    const lastIndex = providerKeys.findIndex((c) => c.id === lastUsedId);
    const nextIndex = lastIndex < 0 ? 0 : (lastIndex + 1) % providerKeys.length;
    return providerKeys[nextIndex];
  }

  toProps(): CredentialsProps {
    return {
      id: this.id,
      activeCredentialId: this.activeCredentialIdValue,
      items: this.credentialItems.map((c) => c.toProps()),
    };
  }
}
