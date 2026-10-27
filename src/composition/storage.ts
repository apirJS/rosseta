import { BrowserCredentialStorageAdapter } from '../adapters/secondary/storage/credentials/BrowserCredentialStorageAdapter';
import { BrowserUserPreferencesStorageAdapter } from '../adapters/secondary/storage/preferences/BrowserUserPreferencesStorageAdapter';
import { BrowserTranslationStorageAdapter } from '../adapters/secondary/storage/history/BrowserTranslationStorageAdapter';
import { BrowserKeySelectionStorageAdapter } from '../adapters/secondary/storage/credentials/BrowserKeySelectionStorageAdapter';
import { BrowserModelStorageAdapter } from '../adapters/secondary/storage/providers/BrowserModelStorageAdapter';
import { BrowserCommandStorageAdapter } from '../adapters/secondary/shortcuts/BrowserCommandStorageAdapter';
import { BrowserCustomProviderStorageAdapter } from '../adapters/secondary/storage/providers/BrowserCustomProviderStorageAdapter';
import { BrowserTranslationCapabilityStorage } from '../adapters/secondary/storage/compatibility/BrowserTranslationCapabilityStorage';
import { BrowserProviderMutationLock } from '../adapters/secondary/storage/providers/BrowserProviderMutationLock';
import { BrowserSettingsBackupStorage } from '../adapters/secondary/storage/settings/BrowserSettingsBackupStorage';

export const createCredentialStorage = () =>
  new BrowserCredentialStorageAdapter();
export const createUserPreferencesStorage = () =>
  new BrowserUserPreferencesStorageAdapter();
export const createTranslationStorage = () =>
  new BrowserTranslationStorageAdapter();
export const createKeySelectionStorage = () =>
  new BrowserKeySelectionStorageAdapter();
export const createModelStorage = () => new BrowserModelStorageAdapter();
export const createCommandStorage = () => new BrowserCommandStorageAdapter();
export const createCustomProviderStorage = () =>
  new BrowserCustomProviderStorageAdapter();
export const createTranslationCapabilityStorage = () =>
  new BrowserTranslationCapabilityStorage();
export const createProviderMutationLock = () =>
  new BrowserProviderMutationLock();
export const createSettingsBackupStorage = () =>
  new BrowserSettingsBackupStorage();
