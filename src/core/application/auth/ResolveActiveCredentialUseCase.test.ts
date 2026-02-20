import { describe, expect, test } from 'bun:test';
import { ResolveActiveCredentialUseCase } from './ResolveActiveCredentialUseCase';
import { FakeKeySelectionStorage } from '../../../../tests/fakes/FakeKeySelectionStorage';
import { KeySelectionMode } from '../../domain/credential/KeySelectionMode';
import { Credentials } from '../../domain/credential/Credentials';
import { Credential } from '../../domain/credential/Credential';
import { ApiKey } from '../../domain/credential/ApiKey';
import { AuthError, ErrorCode } from '../../../shared/errors';

const GEMINI_KEY_1 = 'AIzaSyA1234567890abcdefghijklmnopqrstuv';
const GEMINI_KEY_2 = 'AIzaSyB1234567890abcdefghijklmnopqrstuv';
const GROQ_KEY_1 = 'gsk_' + 'a'.repeat(52);

function makeCredential(id: string, raw: string): Credential {
  const apiKey = ApiKey.create(raw);
  if (!apiKey.success) throw new Error('Test helper: invalid API key');
  const cred = Credential.create(id, apiKey.data, apiKey.data.provider);
  if (!cred.success) throw new Error('Test helper: invalid credential');
  return cred.data;
}

function createUseCase() {
  const storage = new FakeKeySelectionStorage();
  const useCase = new ResolveActiveCredentialUseCase(storage);
  return { storage, useCase };
}

describe('Application: ResolveActiveCredentialUseCase', () => {
  test('returns getActive() in manual mode', async () => {
    const { useCase } = createUseCase();
    const g1 = makeCredential('g1', GEMINI_KEY_1);
    const q1 = makeCredential('q1', GROQ_KEY_1);
    const creds = Credentials.createEmpty('c').add(g1).add(q1);
    // q1 is active (last added)

    const result = await useCase.execute(creds);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('q1');
    }
  });

  test('round-robins gemini keys in auto-balance:gemini mode', async () => {
    const { storage, useCase } = createUseCase();
    storage.seedMode(KeySelectionMode.autoBalanceGemini());

    const g1 = makeCredential('g1', GEMINI_KEY_1);
    const g2 = makeCredential('g2', GEMINI_KEY_2);
    const creds = Credentials.createEmpty('c').add(g1).add(g2);

    // First call: no lastUsedId → returns g1
    const r1 = await useCase.execute(creds);
    expect(r1.success).toBe(true);
    if (r1.success) expect(r1.data.id).toBe('g1');

    // Second call: lastUsedId is g1 → returns g2
    const r2 = await useCase.execute(creds);
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.data.id).toBe('g2');

    // Third call: lastUsedId is g2 → wraps to g1
    const r3 = await useCase.execute(creds);
    expect(r3.success).toBe(true);
    if (r3.success) expect(r3.data.id).toBe('g1');
  });

  test('falls back to manual when provider has < 2 keys', async () => {
    const { storage, useCase } = createUseCase();
    storage.seedMode(KeySelectionMode.autoBalanceGemini());

    const g1 = makeCredential('g1', GEMINI_KEY_1);
    const creds = Credentials.createEmpty('c').add(g1);
    // Only 1 gemini key → should fall back to getActive()

    const result = await useCase.execute(creds);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('g1');
    }
  });

  test('fails when manual mode and no active credential', async () => {
    const { useCase } = createUseCase();
    const creds = Credentials.createEmpty('c');

    const result = await useCase.execute(creds);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AuthError);
      expect(result.error.code).toBe(ErrorCode.AUTH_NOT_AUTHENTICATED);
    }
  });
});
