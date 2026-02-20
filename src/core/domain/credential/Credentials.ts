import { AggregateRoot } from '../shared/AggregateRoot';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';
import { Credential, type CredentialProps } from './Credential';
import type { Provider } from './Provider';

export interface CredentialsProps {
  id: string;
  activeCredentialId: string | null;
  items: CredentialProps[];
}

export class Credentials extends AggregateRoot<string> {
  private constructor(
    id: string,
    private _items: Credential[],
    private _activeCredentialId: string | null,
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
    return this._items;
  }

  get activeCredentialId(): string | null {
    return this._activeCredentialId;
  }

  hasKeys(): boolean {
    return this._items.length > 0;
  }

  getActive(): Credential | null {
    if (!this._activeCredentialId) return null;
    return this._items.find((c) => c.id === this._activeCredentialId) ?? null;
  }

  add(credential: Credential): Credentials {
    const filtered = this._items.filter((c) => c.id !== credential.id);
    const newItems = [...filtered, credential];
    const activeId = credential.id;
    return new Credentials(this.id, newItems, activeId);
  }

  remove(credentialId: string): Credentials {
    const newItems = this._items.filter((c) => c.id !== credentialId);
    let activeId = this._activeCredentialId;

    if (activeId === credentialId) {
      activeId = newItems.length > 0 ? newItems[0].id : null;
    }

    return new Credentials(this.id, newItems, activeId);
  }

  setActive(credentialId: string): Result<Credentials, DomainError> {
    const exists = this._items.some((c) => c.id === credentialId);
    if (!exists) {
      return failure(new DomainError('Credential not found'));
    }
    return success(new Credentials(this.id, [...this._items], credentialId));
  }

  /** Filter credentials by provider. */
  getByProvider(provider: Provider): Credential[] {
    return this._items.filter((c) => c.provider === provider);
  }

  /**
   * Round-robin: return the next credential for a provider after `lastUsedId`.
   * Wraps around to the first key when reaching the end.
   * Returns null if no credentials exist for the provider.
   */
  getNextRoundRobin(
    provider: Provider,
    lastUsedId: string | null,
  ): Credential | null {
    const providerKeys = this.getByProvider(provider);
    if (providerKeys.length === 0) return null;

    if (!lastUsedId) return providerKeys[0];

    const lastIndex = providerKeys.findIndex((c) => c.id === lastUsedId);
    // If not found or at end, wrap to first
    const nextIndex = lastIndex < 0 ? 0 : (lastIndex + 1) % providerKeys.length;
    return providerKeys[nextIndex];
  }

  toProps(): CredentialsProps {
    return {
      id: this.id,
      activeCredentialId: this._activeCredentialId,
      items: this._items.map((c) => c.toProps()),
    };
  }
}
