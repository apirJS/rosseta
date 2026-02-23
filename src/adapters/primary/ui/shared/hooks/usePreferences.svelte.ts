import type { IGetPreferencesUseCase } from '../../../../../core/ports/inbound/preferences/IGetPreferencesUseCase';
import type { IUpdatePreferencesUseCase } from '../../../../../core/ports/inbound/preferences/IUpdatePreferencesUseCase';
import type { IGetShortcutUseCase } from '../../../../../core/ports/inbound/command/IGetShortcutUseCase';
import {
  Theme,
  type ThemeValue,
} from '../../../../../core/domain/preferences/Theme';
import { AiModel } from '../../../../../core/domain/preferences/AiModel';
import {
  Language,
  type LanguageCode,
} from '../../../../../core/domain/translation/Language';
import { LANGUAGE_MAP } from '../../../../../core/domain/translation/LANGUAGE_MAP';
import { ProviderRegistry } from '../../../../../core/domain/provider/ProviderRegistry';

export function getBrowserLanguage(): Language {
  const browserLang = navigator.language;
  const browserBase = browserLang.split('-')[0].toLowerCase();

  if (browserLang in LANGUAGE_MAP) {
    return Language.create(browserLang as LanguageCode);
  }

  for (const code of Object.keys(LANGUAGE_MAP) as LanguageCode[]) {
    if (code.split('-')[0].toLowerCase() === browserBase) {
      return Language.create(code);
    }
  }
  return Language.create('en-US');
}

export class PreferencesState {
  theme = $state<Theme>(Theme.system());
  resolvedTheme = $state<'dark' | 'light'>('light');
  targetLanguage = $state<Language>(getBrowserLanguage());
  selectedModel = $state<AiModel>(
    AiModel.create(ProviderRegistry.getDefaultModelId('gemini')),
  );
  loading = $state(false);
  loaded = $state(false);
  shortcut = $state<string | null>(null);
  proxyUrl = $state<string | null>(null);
}

export interface PreferencesUseCasesDeps {
  getPreferences: IGetPreferencesUseCase;
  updatePreferences: IUpdatePreferencesUseCase;
  getShortcut: IGetShortcutUseCase;
  checkProxyHealth: {
    execute(
      proxyUrl: string,
    ): Promise<
      import('../../../../../shared/types/Result').Result<
        boolean,
        import('../../../../../shared/errors').AppError
      >
    >;
  };
  onThemeApplied?: (theme: 'dark' | 'light') => void;
}

export function usePreferences(useCases: PreferencesUseCasesDeps) {
  const state = new PreferencesState();

  function resolveTheme(theme: Theme): 'dark' | 'light' {
    if (theme.isSystem) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return theme.isDark ? 'dark' : 'light';
  }

  function applyTheme(resolved: 'dark' | 'light') {
    state.resolvedTheme = resolved;
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Notify external handler (e.g. broadcast to content script)
    useCases.onThemeApplied?.(resolved);
  }

  async function load() {
    state.loading = true;
    const result = await useCases.getPreferences.execute();

    if (result.success && result.data) {
      state.theme = result.data.theme;
      state.targetLanguage = result.data.targetLanguage;
      state.selectedModel = result.data.selectedModel;
      state.proxyUrl = result.data.proxyUrl;
    }

    const shortcutResult =
      await useCases.getShortcut.execute('START_EXTENSION');
    if (shortcutResult.success) {
      state.shortcut = shortcutResult.data;
    }

    applyTheme(resolveTheme(state.theme));
    state.loading = false;
    state.loaded = true;
  }

  async function setTheme(themeValue: ThemeValue) {
    const theme = Theme.create(themeValue);
    state.theme = theme;
    applyTheme(resolveTheme(theme));
    await useCases.updatePreferences.execute({
      preferences: { theme: themeValue },
    });
  }

  async function toggleTheme() {
    const next = state.resolvedTheme === 'dark' ? 'light' : 'dark';
    await setTheme(next);
  }

  async function setTargetLanguage(languageCode: LanguageCode) {
    const language = Language.create(languageCode);
    state.targetLanguage = language;
    await useCases.updatePreferences.execute({
      preferences: { targetLanguage: languageCode },
    });
  }

  async function setSelectedModel(modelId: string) {
    const model = AiModel.create(modelId);
    state.selectedModel = model;
    await useCases.updatePreferences.execute({
      preferences: { selectedModel: modelId },
    });
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    if (state.theme.isSystem) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  load();

  async function setProxyUrl(proxyUrl: string | null) {
    state.proxyUrl = proxyUrl;
    await useCases.updatePreferences.execute({
      preferences: { proxyUrl },
    });
  }

  async function checkProxyHealth(proxyUrl: string) {
    return useCases.checkProxyHealth.execute(proxyUrl);
  }

  return {
    state,
    setTheme,
    toggleTheme,
    setTargetLanguage,
    setSelectedModel,
    setProxyUrl,
    checkProxyHealth,
  };
}
