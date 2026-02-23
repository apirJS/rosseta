import { AggregateRoot } from '../shared/AggregateRoot';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';
import { Theme, type ThemeValue } from './Theme';
import { AiModel } from './AiModel';
import { Language, type LanguageCode } from '../translation/Language';
import { ProviderRegistry } from '../provider/ProviderRegistry';

export interface UserPreferencesProps {
  id: string;
  theme: ThemeValue;
  targetLanguage: LanguageCode;
  selectedModel: string;
  proxyUrl: string | null;
}

export class UserPreferences extends AggregateRoot<string> {
  private constructor(
    id: string,
    private readonly _theme: Theme,
    private readonly _targetLanguage: Language,
    private readonly _selectedModel: AiModel,
    private readonly _proxyUrl: string | null = null,
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

  public get selectedModel(): AiModel {
    return this._selectedModel;
  }

  public get proxyUrl(): string | null {
    return this._proxyUrl;
  }

  public get shortcut(): string | null {
    return this._shortcut;
  }

  public toProps(): UserPreferencesProps {
    return {
      id: this.id,
      theme: this._theme.value,
      targetLanguage: this._targetLanguage.code,
      selectedModel: this._selectedModel.id,
      proxyUrl: this._proxyUrl,
    };
  }

  public static fromRaw(
    props: Partial<{
      id: string;
      theme: string;
      targetLanguage: string;
      selectedModel: string;
      proxyUrl: string | null;
    }>,
  ): Result<UserPreferences, DomainError> {
    if (!props.id) {
      return failure(new DomainError('UserPreferences ID is missing'));
    }

    const themeResult = Theme.fromRaw(props.theme ?? 'system');
    if (!themeResult.success) return failure(themeResult.error);

    const languageResult = Language.fromRaw(props.targetLanguage ?? 'en-US');
    if (!languageResult.success) return failure(languageResult.error);

    const fallbackModelId = ProviderRegistry.getDefaultModelId('gemini');
    const modelResult = AiModel.fromRaw(props.selectedModel ?? fallbackModelId);
    if (!modelResult.success) return failure(modelResult.error);

    return success(
      new UserPreferences(
        props.id,
        themeResult.data,
        languageResult.data,
        modelResult.data,
        props.proxyUrl ?? null,
        null,
      ),
    );
  }

  public static createDefault(id: string): UserPreferences {
    const defaultModelId = ProviderRegistry.getDefaultModelId('gemini');
    return new UserPreferences(
      id,
      Theme.system(),
      Language.create('en-US'),
      AiModel.create(defaultModelId),
      null,
      null,
    );
  }

  public withTheme(theme: Theme): UserPreferences {
    return new UserPreferences(
      this.id,
      theme,
      this._targetLanguage,
      this._selectedModel,
      this._proxyUrl,
      this._shortcut,
    );
  }

  public withTargetLanguage(language: Language): UserPreferences {
    return new UserPreferences(
      this.id,
      this._theme,
      language,
      this._selectedModel,
      this._proxyUrl,
      this._shortcut,
    );
  }

  public withSelectedModel(model: AiModel): UserPreferences {
    return new UserPreferences(
      this.id,
      this._theme,
      this._targetLanguage,
      model,
      this._proxyUrl,
      this._shortcut,
    );
  }

  public withProxyUrl(proxyUrl: string | null): UserPreferences {
    return new UserPreferences(
      this.id,
      this._theme,
      this._targetLanguage,
      this._selectedModel,
      proxyUrl,
      this._shortcut,
    );
  }

  public withShortcut(shortcut: string | null): UserPreferences {
    return new UserPreferences(
      this.id,
      this._theme,
      this._targetLanguage,
      this._selectedModel,
      this._proxyUrl,
      shortcut,
    );
  }
}
