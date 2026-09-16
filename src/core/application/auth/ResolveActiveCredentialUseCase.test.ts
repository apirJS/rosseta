import { describe, expect, test } from 'bun:test';
import { ResolveActiveCredentialUseCase } from './ResolveActiveCredentialUseCase';
import { FakeKeySelectionStorage } from '../../../../tests/fakes/FakeKeySelectionStorage';
import { KeySelectionMode } from '../../domain/credential/KeySelectionMode';
import { Credentials } from '../../domain/credential/Credentials';
import { Credential } from '../../domain/credential/Credential';
import { ApiKey } from '../../domain/credential/ApiKey';
import { AuthError, StorageError } from '../../../shared/errors';

const GOOGLE_KEY_1 = 'AIzaSyA1234567890abcdefghijklmnopqrstuv';
const GOOGLE_KEY_2 = 'AIzaSyB1234567890abcdefghijklmnopqrstuv';
const GROQ_KEY_1 = 'gsk_' + 'a'.repeat(52);

function makeCredential(
  id: string,
  raw: string,
  provider: 'google' | 'groq',
): Credential {
  const apiKey = ApiKey.createWithProvider(raw, provider);
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
    const g1 = makeCredential('g1', GOOGLE_KEY_1, 'google');
    const q1 = makeCredential('q1', GROQ_KEY_1, 'groq');
    const creds = Credentials.createEmpty('c').add(g1).add(q1);

    const result = await useCase.execute(creds);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('q1');
    }
  });

  test('round-robins google keys in auto-balance:google mode', async () => {
    const { storage, useCase } = createUseCase();
    storage.seedMode(KeySelectionMode.autoBalance('google'));

    const g1 = makeCredential('g1', GOOGLE_KEY_1, 'google');
    const g2 = makeCredential('g2', GOOGLE_KEY_2, 'google');
    const creds = Credentials.createEmpty('c').add(g1).add(g2);

    const r1 = await useCase.execute(creds);
    expect(r1.success).toBe(true);
    if (r1.success) expect(r1.data.id).toBe('g1');

    const r2 = await useCase.execute(creds);
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.data.id).toBe('g2');

    const r3 = await useCase.execute(creds);
    expect(r3.success).toBe(true);
    if (r3.success) expect(r3.data.id).toBe('g1');
  });

  test('falls back to manual when provider has fewer than 2 keys', async () => {
    const { storage, useCase } = createUseCase();
    storage.seedMode(KeySelectionMode.autoBalance('google'));

    const g1 = makeCredential('g1', GOOGLE_KEY_1, 'google');
    const creds = Credentials.createEmpty('c').add(g1);

    const result = await useCase.execute(creds);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe('g1');
  });

  test('falls back to manual when storage read fails', async () => {
    const { storage, useCase } = createUseCase();
    storage.failNextCallWith(
      StorageError.readFailed('keySelectionMode'),
    );

    const g1 = makeCredential('g1', GOOGLE_KEY_1, 'google');
    const creds = Credentials.createEmpty('c').add(g1);

    const result = await useCase.execute(creds);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe('g1');
  });

  test('round-robins groq keys in auto-balance:groq mode', async () => {
    const { storage, useCase } = createUseCase();
    storage.seedMode(KeySelectionMode.autoBalance('groq'));

    const q1 = makeCredential('q1', GROQ_KEY_1, 'groq');
    const q2 = makeCredential('q2', 'gsk_' + 'b'.repeat(52), 'groq');
    const creds = Credentials.createEmpty('c').add(q1).add(q2);

    const r1 = await useCase.execute(creds);
    expect(r1.success).toBe(true);
    if (r1.success) expect(r1.data.id).toBe('q1');

    const r2 = await useCase.execute(creds);
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.data.id).toBe('q2');
  });

  test('fails when no credentials and no active key', async () => {
    const { useCase } = createUseCase();
    const creds = Credentials.createEmpty('c');

    const result = await useCase.execute(creds);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AuthError);
    }
  });
});
