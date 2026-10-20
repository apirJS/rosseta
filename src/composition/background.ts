import { GetCredentialsUseCase } from '../core/application/credentials/GetCredentialUseCase';
import { ResolveActiveCredentialUseCase } from '../core/application/credentials/ResolveActiveCredentialUseCase';
import { ResolveTranslationConfigurationUseCase } from '../core/application/translation/ResolveTranslationConfigurationUseCase';
import { RefreshProviderModelsUseCase } from '../core/application/providers/RefreshProviderModelsUseCase';
import { SaveTranslationUseCase } from '../core/application/history/SaveTranslationUseCase';
import { GetTranslationUseCase } from '../core/application/history/GetTranslationUseCase';
import { GetAllTranslationsUseCase } from '../core/application/history/GetAllTranslationsUseCase';
import { createTranslationService } from '../adapters/secondary/providers/create-provider-runtime';
import { ModelFetchService } from '../adapters/secondary/providers/catalogs/ModelFetchService';
import { TranslationRequestPreparer } from '../adapters/primary/background/translation/TranslationRequestPreparer';
import { TranslationJobCoordinator } from '../adapters/primary/background/translation/TranslationJobCoordinator';
import { TranslateImageHandler } from '../adapters/primary/background/translation/TranslateImageHandler';
import { FetchModelsHandler } from '../adapters/primary/background/providers/FetchModelsHandler';
import { StartOverlayHandler } from '../adapters/primary/background/capture/StartOverlayHandler';
import { OverlayService } from '../adapters/primary/background/capture/OverlayService';
import { MountHistoryModalHandler } from '../adapters/primary/background/history/MountHistoryModalHandler';
import { MessageRouter } from '../adapters/primary/background/messaging/MessageRouter';
import {
  createCredentialStorage,
  createUserPreferencesStorage,
  createTranslationStorage,
  createKeySelectionStorage,
  createModelStorage,
  createCustomProviderStorage,
  createTranslationCapabilityStorage,
  createProviderMutationLock,
} from './storage';

/** One background lifetime owns the capability store and provider networking. */
export function createBackgroundDependencies() {
  const credentialStorage = createCredentialStorage();
  const preferencesStorage = createUserPreferencesStorage();
  const translationStorage = createTranslationStorage();
  const keySelectionStorage = createKeySelectionStorage();
  const modelStorage = createModelStorage();
  const customProviderStorage = createCustomProviderStorage();
  const translationCapabilityStorage = createTranslationCapabilityStorage();
  const getCredentialsUseCase = new GetCredentialsUseCase(credentialStorage);

  const resolveTranslationConfigurationUseCase =
    new ResolveTranslationConfigurationUseCase({
      credentialStorage,
      preferencesStorage,
      modelStorage,
      customProviderStorage,
      resolveActiveCredential: new ResolveActiveCredentialUseCase(
        keySelectionStorage,
      ),
    });

  return {
    getCredentialsUseCase,
    resolveTranslationConfigurationUseCase,
    translationCapabilityStorage,
    saveTranslationUseCase: new SaveTranslationUseCase(translationStorage),
    getTranslationUseCase: new GetTranslationUseCase(translationStorage),
    getAllTranslationsUseCase: new GetAllTranslationsUseCase(
      translationStorage,
    ),
    refreshProviderModelsUseCase: new RefreshProviderModelsUseCase({
      credentialStorage,
      preferencesStorage,
      modelStorage,
      customProviderStorage,
      capabilityStorage: translationCapabilityStorage,
      mutationLock: createProviderMutationLock(),
      modelFetchService: new ModelFetchService(),
    }),
  };
}

export function createBackgroundRuntime(deps = createBackgroundDependencies()) {
  const overlayService = new OverlayService({
    getCredentialsUseCase: deps.getCredentialsUseCase,
  });

  const preparer = new TranslationRequestPreparer({
    resolveTranslationConfigurationUseCase:
      deps.resolveTranslationConfigurationUseCase,
    createService: (config) =>
      createTranslationService(
        {
          credential: config.credential,
          modelId: config.modelId,
          includeDescription: config.includeDescription,
          customProviderConfig: config.customProvider,
        },
        deps.translationCapabilityStorage,
      ),
  });

  const coordinator = new TranslationJobCoordinator(
    {
      saveTranslationUseCase: deps.saveTranslationUseCase,
      getTranslationUseCase: deps.getTranslationUseCase,
    },
    preparer,
  );

  const messageRouter = new MessageRouter({
    translateImage: new TranslateImageHandler(coordinator),
    startOverlay: new StartOverlayHandler(overlayService),
    mountHistory: new MountHistoryModalHandler(),
    fetchModels: new FetchModelsHandler(deps.refreshProviderModelsUseCase),
  });

  return {
    overlayService,
    messageRouter,
    getAllTranslations: deps.getAllTranslationsUseCase,
  };
}
