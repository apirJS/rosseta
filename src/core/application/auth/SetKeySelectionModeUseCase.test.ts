import { describe, expect, test } from 'bun:test';
import { SetKeySelectionModeUseCase } from './SetKeySelectionModeUseCase';
import { FakeKeySelectionStorage } from '../../../../tests/fakes/FakeKeySelectionStorage';
import { FakeCredentialStorage } from '../../../../tests/fakes/FakeCredentialStorage';
import { KeySelectionMode } from '../../domain/credential/KeySelectionMode';
import { Credentials } from '../../domain/credential/Credentials';
import { Credential } from '../../domain/credential/Credential';
import { ApiKey } from '../../domain/credential/ApiKey';
import { AuthError, ErrorCode } from '../../../shared/errors';

const GEMINI_KEY_1 = 'AIzaSyA1234567890abcdefghijklmnopqrstuv';
const GEMINI_KEY_2 = 'AIzaSyB1234567890abcdefghijklmnopqrstuv';
const GROQ_KEY_1 = 'gsk_' + 'a'.repeat(52);
const GROQ_KEY_2 = 'gsk_' + 'b'.repeat(52);

function makeCredential(id: string, raw: string): Credential {
  const apiKey = ApiKey.create(raw);
  if (!apiKey.success) throw new Error('Test helper: invalid API key');
  const cred = Credential.create(id, apiKey.data, apiKey.data.provider);
  if (!cred.success) throw new Error('Test helper: invalid credential');
  return cred.data;
}

function createUseCase() {
  const keySelectionStorage = new FakeKeySelectionStorage();
  const credentialStorage = new FakeCredentialStorage();
  const useCase = new SetKeySelectionModeUseCase(
    keySelectionStorage,
    credentialStorage,
  );
  return { keySelectionStorage, credentialStorage, useCase };
}

describe('Application: SetKeySelectionModeUseCase', () => {
  test('sets manual mode without credential check', async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute(KeySelectionMode.manual());

    expect(result.success).toBe(true);
  });

  test('sets auto-balance:gemini when ≥ 2 gemini keys exist', async () => {
    const { credentialStorage, useCase } = createUseCase();
    const creds = Credentials.createEmpty('creds-1')
      .add(makeCredential('g1', GEMINI_KEY_1))
      .add(makeCredential('g2', GEMINI_KEY_2));
    credentialStorage.seedWith(creds);

    const result = await useCase.execute(KeySelectionMode.autoBalanceGemini());

    expect(result.success).toBe(true);
  });

  test('sets auto-balance:groq when ≥ 2 groq keys exist', async () => {
    const { credentialStorage, useCase } = createUseCase();
    const creds = Credentials.createEmpty('creds-1')
      .add(makeCredential('q1', GROQ_KEY_1))
      .add(makeCredential('q2', GROQ_KEY_2));
    credentialStorage.seedWith(creds);

    const result = await useCase.execute(KeySelectionMode.autoBalanceGroq());

    expect(result.success).toBe(true);
  });

  test('fails auto-balance:gemini with only 1 gemini key', async () => {
    const { credentialStorage, useCase } = createUseCase();
    const creds = Credentials.createEmpty('creds-1').add(
      makeCredential('g1', GEMINI_KEY_1),
    );
    credentialStorage.seedWith(creds);

    const result = await useCase.execute(KeySelectionMode.autoBalanceGemini());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AuthError);
      expect(result.error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
    }
  });

  test('fails auto-balance when no credentials stored', async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute(KeySelectionMode.autoBalanceGroq());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AuthError);
    }
  });
});
