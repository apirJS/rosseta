import { ValueObject } from '../shared/ValueObject';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';
import { isAnyProvider, type AnyProvider } from './Provider';

const AUTO_BALANCE_PREFIX = 'auto-balance:';

export type KeySelectionModeValue = 'manual' | `auto-balance:${AnyProvider}`;

export class KeySelectionMode extends ValueObject {
  private constructor(private readonly modeValue: KeySelectionModeValue) {
    super();
  }

  public get value(): KeySelectionModeValue {
    return this.modeValue;
  }

  public get isManual(): boolean {
    return this.modeValue === 'manual';
  }

  public get isAutoBalance(): boolean {
    return this.modeValue.startsWith(AUTO_BALANCE_PREFIX);
  }

  public get autoBalanceProvider(): AnyProvider | null {
    if (!this.isAutoBalance) return null;
    return this.modeValue.slice(AUTO_BALANCE_PREFIX.length) as AnyProvider;
  }

  public get label(): string {
    if (this.isManual) return 'Manual';
    const provider = this.autoBalanceProvider;
    return `Auto balance (round robin) ${provider?.toUpperCase() ?? ''}`;
  }

  public static create(value: KeySelectionModeValue): KeySelectionMode {
    return new KeySelectionMode(value);
  }

  public static fromRaw(raw: string): Result<KeySelectionMode, DomainError> {
    if (!raw || typeof raw !== 'string') {
      return failure(
        new DomainError('Key selection mode must be a non-empty string'),
      );
    }

    if (raw === 'manual') {
      return success(new KeySelectionMode('manual'));
    }

    if (raw.startsWith(AUTO_BALANCE_PREFIX)) {
      const provider = raw.slice(AUTO_BALANCE_PREFIX.length);
      if (isAnyProvider(provider)) {
        return success(
          new KeySelectionMode(`${AUTO_BALANCE_PREFIX}${provider}`),
        );
      }
    }

    return failure(
      new DomainError(
        `Invalid key selection mode: ${raw}. Must be "manual" or "auto-balance:<provider>"`,
      ),
    );
  }

  public static manual(): KeySelectionMode {
    return new KeySelectionMode('manual');
  }

  public static autoBalance(provider: AnyProvider): KeySelectionMode {
    return new KeySelectionMode(`${AUTO_BALANCE_PREFIX}${provider}`);
  }
}
