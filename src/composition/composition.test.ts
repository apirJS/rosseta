import { beforeEach, describe, expect, test } from 'bun:test';
import { createPopupDependencies } from './popup';
import { createBackgroundDependencies } from './background';
import { ApiKey } from '../core/domain/credential/ApiKey';
import { resetBrowserMock } from '../../tests/browser-mock';
import { completeTranslation } from '../../tests/background-translation-fixtures';
import { createProviderMutationLock } from './storage';
import { makeCustomProviderConfig } from '../../tests/fakes/FakeCustomProviderStorage';
import { success } from '../shared/types/Result';
import { settingsBackupFixture } from '../../tests/settings-backup-fixtures';

describe('Composition: independent browser contexts', () => {
  beforeEach(resetBrowserMock);

  test('a key and selection saved by the popup resolve in a fresh background snapshot', async () => {
    const popup = createPopupDependencies();
    const background = createBackgroundDependencies();
    const apiKey = ApiKey.createWithProvider('synthetic-key', 'deepseek');

    if (!apiKey.success) throw apiKey.error;

    expect(
      (await popup.addApiKeyUseCase.execute({ apiKey: apiKey.data })).success,
    ).toBe(true);

    expect(
      (
        await popup.updatePreferencesUseCase.execute({
          preferences: {
            targetLanguage: 'id-ID',
            selectedModels: { deepseek: 'my-model' },
            includeDescription: false,
          },
        })
      ).success,
    ).toBe(true);

    const resolved =
      await background.resolveTranslationConfigurationUseCase.execute();

    expect(resolved.success).toBe(true);
    if (!resolved.success) throw resolved.error;
    expect(resolved.data.credential.provider).toBe('deepseek');
    expect(resolved.data.modelId).toBe('my-model');
    expect(resolved.data.targetLanguage.code).toBe('id-ID');
    expect(resolved.data.includeDescription).toBe(false);
  });

  test('a completed background save is visible and removable through popup history actions', async () => {
    const background = createBackgroundDependencies();
    const popup = createPopupDependencies();
    const translation = completeTranslation('composition-result', new Date());

    const saved = await background.saveTranslationUseCase.execute({
      translation,
    });

    expect(saved.success).toBe(true);

    expect((await popup.getAllTranslationsUseCase.execute()).success).toBe(
      true,
    );

    const loaded = await background.getTranslationUseCase.execute(
      translation.id,
    );

    expect(loaded.success && loaded.data?.id).toBe(translation.id);

    expect(
      (await popup.deleteTranslationUseCase.execute(translation.id)).success,
    ).toBe(true);

    expect(
      await background.getTranslationUseCase.execute(translation.id),
    ).toEqual({ success: true, data: null });
  });

  test('popup provider deletion waits for the canonical provider mutation boundary', async () => {
    const popup = createPopupDependencies();
    const provider = 'custom-composition-delete';

    await popup.customProviderStorage.save(
      makeCustomProviderConfig({ id: provider }),
    );

    await popup.modelStorage.setModels(provider, [
      { id: 'old', name: 'Old', source: 'manual' },
    ]);

    let release!: () => void;
    let started!: () => void;

    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });

    const holding = createProviderMutationLock().run(provider, async () => {
      started();
      await held;

      return success(undefined);
    });

    await entered;

    let deleted = false;

    const deleting = popup.removeCustomProviderUseCase
      .execute(provider)
      .then((result) => {
        deleted = true;

        return result;
      });

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const deletionWaited = !deleted;

    release();
    await holding;
    expect((await deleting).success).toBe(true);
    expect(deletionWaited).toBe(true);

    const models = await popup.modelStorage.getModels(provider);

    expect(models.success && models.data).toEqual([]);

    const configs = await popup.customProviderStorage.load();

    expect(configs.success && configs.data).toEqual([]);
  });

  test('a settings import is usable by a fresh background and can be exported unchanged', async () => {
    const backup = settingsBackupFixture();

    backup.settings.history[0]!.createdAt = new Date().toISOString();

    const popup = createPopupDependencies();

    expect((await popup.importSettingsUseCase.execute(backup)).success).toBe(
      true,
    );

    const background = createBackgroundDependencies();

    const resolved =
      await background.resolveTranslationConfigurationUseCase.execute();

    expect(resolved.success).toBe(true);
    if (!resolved.success) throw resolved.error;
    expect(resolved.data.credential.provider).toBe('openai');
    expect(resolved.data.modelId).toBe('vision-model');
    expect(resolved.data.targetLanguage.code).toBe('en-US');

    const exported =
      await createPopupDependencies().exportSettingsUseCase.execute();

    expect(exported.success && exported.data.settings).toEqual(backup.settings);
  });
});
