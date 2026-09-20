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
    private readonly themeValue: Theme,
    private readonly targetLanguageValue: Language,
    private readonly selectedModelsValue: Readonly<Record<string, string>>,
    private readonly includeDescriptionValue: boolean = true,
    private readonly shortcutValue: string | null = null,
  ) {
    super(id);
  }

  public get theme(): Theme {
    return this.themeValue;
  }

  public get targetLanguage(): Language {
    return this.targetLanguageValue;
  }

  public get selectedModels(): Readonly<Record<string, string>> {
    return this.selectedModelsValue;
  }

  public get includeDescription(): boolean {
    return this.includeDescriptionValue;
  }

  public get shortcut(): string | null {
    return this.shortcutValue;
  }

  public getModelIdFor(provider: string): string {
    return this.selectedModelsValue[provider] ?? ProviderRegistry.getDefaultModelId(provider);
  }

  public hasSelectedModel(provider: string): boolean {
    return this.getModelIdFor(provider).length > 0;
  }

  /**
   * Resolves the model id to use for a provider, validated against the
   * models actually available. Falls back to the registry default, then
   * the first available model, when the saved selection is stale. With no
   * available models there is nothing to validate against, so the current
   * effective id is returned unchanged.
   */
  public resolveModelIdFor(
    provider: string,
    availableModels: ReadonlyArray<{ id: string }>,
  ): string {
    const saved = this.selectedModelsValue[provider];
    if (saved && availableModels.some((m) => m.id === saved)) return saved;

    const defaultId = ProviderRegistry.getDefaultModelId(provider);
    if (defaultId && availableModels.some((m) => m.id === defaultId)) {
      return defaultId;
    }

    return availableModels[0]?.id ?? saved ?? defaultId;
  }

  public toProps(): UserPreferencesProps {
    return {
      id: this.id,
      theme: this.themeValue.value,
      targetLanguage: this.targetLanguageValue.code,
      selectedModels: { ...this.selectedModelsValue },
      includeDescription: this.includeDescriptionValue,
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
      this.targetLanguageValue,
      this.selectedModelsValue,
      this.includeDescriptionValue,
      this.shortcutValue,
    );
  }

  public withTargetLanguage(language: Language): UserPreferences {
    return new UserPreferences(
      this.id,
      this.themeValue,
      language,
      this.selectedModelsValue,
      this.includeDescriptionValue,
      this.shortcutValue,
    );
  }

  public withSelectedModel(
    provider: string,
    modelId: string,
  ): UserPreferences {
    return new UserPreferences(
      this.id,
      this.themeValue,
      this.targetLanguageValue,
      { ...this.selectedModelsValue, [provider]: modelId },
      this.includeDescriptionValue,
      this.shortcutValue,
    );
  }

  public withIncludeDescription(includeDescription: boolean): UserPreferences {
    return new UserPreferences(
      this.id,
      this.themeValue,
      this.targetLanguageValue,
      this.selectedModelsValue,
      includeDescription,
      this.shortcutValue,
    );
  }

  public withShortcut(shortcut: string | null): UserPreferences {
    return new UserPreferences(
      this.id,
      this.themeValue,
      this.targetLanguageValue,
      this.selectedModelsValue,
      this.includeDescriptionValue,
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
