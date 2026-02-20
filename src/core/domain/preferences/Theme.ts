import { ValueObject } from '../shared/ValueObject';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';

export const THEME_OPTIONS = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
} as const;

export type ThemeValue = keyof typeof THEME_OPTIONS;

export class Theme extends ValueObject {
  private constructor(private readonly _value: ThemeValue) {
    super();
  }

  public get value(): ThemeValue {
    return this._value;
  }

  public get isSystem(): boolean {
    return this._value === 'system';
  }

  public get isDark(): boolean {
    return this._value === 'dark';
  }

  public get isLight(): boolean {
    return this._value === 'light';
  }

  /**
   * Create a Theme from a known value (compile-time autocomplete).
   */
  public static create(value: ThemeValue): Theme {
    return new Theme(value);
  }

  /**
   * Create a Theme from raw string input (runtime validation).
   */
  public static fromRaw(raw: string): Result<Theme, DomainError> {
    if (!raw || typeof raw !== 'string') {
      return failure(new DomainError('Theme must be a non-empty string'));
    }

    if (raw in THEME_OPTIONS) {
      return success(Theme.create(raw as ThemeValue));
    }

    return failure(
      new DomainError(`Invalid theme: ${raw}. Must be dark, light, or system`),
    );
  }

  public static system(): Theme {
    return new Theme('system');
  }

  public static dark(): Theme {
    return new Theme('dark');
  }

  public static light(): Theme {
    return new Theme('light');
  }
}
