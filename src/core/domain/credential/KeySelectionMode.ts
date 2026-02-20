import { ValueObject } from '../shared/ValueObject';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';

export const KEY_SELECTION_MODES = {
  manual: 'Manual',
  'auto-balance:gemini': 'Auto balance (round robin) GEMINI',
  'auto-balance:groq': 'Auto balance (round robin) GROQ',
} as const;

export type KeySelectionModeValue = keyof typeof KEY_SELECTION_MODES;

export class KeySelectionMode extends ValueObject {
  private constructor(private readonly _value: KeySelectionModeValue) {
    super();
  }

  public get value(): KeySelectionModeValue {
    return this._value;
  }

  public get isManual(): boolean {
    return this._value === 'manual';
  }

  public get isAutoBalance(): boolean {
    return this._value.startsWith('auto-balance:');
  }

  /** Returns the provider being balanced, or null if manual. */
  public get autoBalanceProvider(): 'gemini' | 'groq' | null {
    if (this._value === 'auto-balance:gemini') return 'gemini';
    if (this._value === 'auto-balance:groq') return 'groq';
    return null;
  }

  public get label(): string {
    return KEY_SELECTION_MODES[this._value];
  }

  /**
   * Create from a known value (compile-time autocomplete).
   */
  public static create(value: KeySelectionModeValue): KeySelectionMode {
    return new KeySelectionMode(value);
  }

  /**
   * Create from raw string input (runtime validation).
   */
  public static fromRaw(raw: string): Result<KeySelectionMode, DomainError> {
    if (!raw || typeof raw !== 'string') {
      return failure(
        new DomainError('Key selection mode must be a non-empty string'),
      );
    }

    if (raw in KEY_SELECTION_MODES) {
      return success(new KeySelectionMode(raw as KeySelectionModeValue));
    }

    return failure(
      new DomainError(
        `Invalid key selection mode: ${raw}. Must be one of: ${Object.keys(KEY_SELECTION_MODES).join(', ')}`,
      ),
    );
  }

  public static manual(): KeySelectionMode {
    return new KeySelectionMode('manual');
  }

  public static autoBalanceGemini(): KeySelectionMode {
    return new KeySelectionMode('auto-balance:gemini');
  }

  public static autoBalanceGroq(): KeySelectionMode {
    return new KeySelectionMode('auto-balance:groq');
  }
}
