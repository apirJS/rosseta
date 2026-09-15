import { AggregateRoot } from '../shared/AggregateRoot';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';
import { Theme, type ThemeValue } from './Theme';
import { Language, type LanguageCode } from '../translation/Language';
import { ProviderRegistry } from '../provider/ProviderRegistry';

export interface UserPreferencesProps {
  id: string;
  theme: ThemeValue;
  targetLanguage: LanguageCode;
  selectedModels: Record<string, string>;
  includeDescription: boolean;
}

export class UserPreferences extends AggregateRoot<string> {
  private constructor(
    id: string,
    private readonly _theme: Theme,
    private readonly _targetLanguage: Language,
    private readonly _selectedModels: Readonly<Record<string, string>>,
    private readonly _includeDescription: boolean = true,
    private readonly _shortcut: string | null = null,
  ) {
    super(id);
  }

  public get theme(): Theme {
    return this._theme;
  }

  public get targetLanguage(): Language {
    return this._targetLanguage;
  }

  public get selectedModels(): Readonly<Record<string, string>> {
    return this._selectedModels;
  }

  public get includeDescription(): boolean {
    return this._includeDescription;
  }

  public get shortcut(): string | null {
    return this._shortcut;
  }

  public getModelIdFor(provider: string): string {
    return this._selectedModels[provider] ?? ProviderRegistry.getDefaultModelId(provider);
  }

  public hasSelectedModel(provider: string): boolean {
    return this.getModelIdFor(provider).length > 0;
  }

  public toProps(): UserPreferencesProps {
    return {
      id: this.id,
      theme: this._theme.value,
      targetLanguage: this._targetLanguage.code,
      selectedModels: { ...this._selectedModels },
      includeDescription: this._includeDescription,
    };
  }

  public static fromRaw(
    props: Partial<{
      id: string;
      theme: string;
      targetLanguage: string;
      selectedModels: Record<string, unknown>;
      includeDescription: boolean;
    }>,
  ): Result<UserPreferences, DomainError> {
    if (!props.id) {
      return failure(new DomainError('UserPreferences ID is missing'));
    }

    const themeResult = Theme.fromRaw(props.theme ?? 'system');
    if (!themeResult.success) return failure(themeResult.error);

    const languageResult = Language.fromRaw(props.targetLanguage ?? 'en-US');
    if (!languageResult.success) return failure(languageResult.error);

    const selectedModels = sanitizeSelectedModels(props.selectedModels);

    return success(
      new UserPreferences(
        props.id,
        themeResult.data,
        languageResult.data,
        selectedModels,
        typeof props.includeDescription === 'boolean'
          ? props.includeDescription
          : true,
        null,
      ),
    );
  }

  public static createDefault(id: string): UserPreferences {
    return new UserPreferences(
      id,
      Theme.system(),
      Language.create('en-US'),
      {},
      true,
      null,
    );
  }

  public withTheme(theme: Theme): UserPreferences {
    return new UserPreferences(
      this.id,
      theme,
      this._targetLanguage,
      this._selectedModels,
      this._includeDescription,
      this._shortcut,
    );
  }

  public withTargetLanguage(language: Language): UserPreferences {
    return new UserPreferences(
      this.id,
      this._theme,
      language,
      this._selectedModels,
      this._includeDescription,
      this._shortcut,
    );
  }

  public withSelectedModel(
    provider: string,
    modelId: string,
  ): UserPreferences {
    return new UserPreferences(
      this.id,
      this._theme,
      this._targetLanguage,
      { ...this._selectedModels, [provider]: modelId },
      this._includeDescription,
      this._shortcut,
    );
  }

  public withIncludeDescription(includeDescription: boolean): UserPreferences {
    return new UserPreferences(
      this.id,
      this._theme,
      this._targetLanguage,
      this._selectedModels,
      includeDescription,
      this._shortcut,
    );
  }

  public withShortcut(shortcut: string | null): UserPreferences {
    return new UserPreferences(
      this.id,
      this._theme,
      this._targetLanguage,
      this._selectedModels,
      this._includeDescription,
      shortcut,
    );
  }
}

function sanitizeSelectedModels(
  raw: Record<string, unknown> | undefined,
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return sanitized;

  for (const [provider, modelId] of Object.entries(raw)) {
    if (typeof modelId === 'string' && modelId.trim().length > 0) {
      sanitized[provider] = modelId.trim();
    }
  }
  return sanitized;
}
