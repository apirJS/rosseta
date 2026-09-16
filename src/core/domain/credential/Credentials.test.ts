import { describe, expect, test } from 'bun:test';
import { Credentials } from './Credentials';
import { Credential } from './Credential';
import { ApiKey } from './ApiKey';
import { DomainError } from '../shared/DomainError';

const VALID_GOOGLE_KEY = 'AIzaSyA1234567890abcdefghijklmnopqrstuv';
const VALID_GROQ_KEY = 'gsk_' + 'a'.repeat(52);

function makeCredential(
  id: string,
  raw: string = VALID_GOOGLE_KEY,
  provider: 'google' | 'groq' = 'google',
): Credential {
  const apiKey = ApiKey.createWithProvider(raw, provider);
  if (!apiKey.success) throw new Error('Test helper: invalid API key');
  const cred = Credential.create(id, apiKey.data, apiKey.data.provider);
  if (!cred.success) throw new Error('Test helper: invalid credential');
  return cred.data;
}

describe('Domain: Credentials (Aggregate)', () => {
  describe('createEmpty', () => {
    test('creates with no items and null active', () => {
      const creds = Credentials.createEmpty('creds-1');
      expect(creds.id).toBe('creds-1');
      expect(creds.items).toHaveLength(0);
      expect(creds.activeCredentialId).toBeNull();
      expect(creds.hasKeys()).toBe(false);
      expect(creds.getActive()).toBeNull();
    });
  });

  describe('add', () => {
    test('adds a credential and sets it as active', () => {
      const empty = Credentials.createEmpty('creds-1');
      const cred = makeCredential('c1');
      const updated = empty.add(cred);

      expect(updated.items).toHaveLength(1);
      expect(updated.activeCredentialId).toBe('c1');
      expect(updated.hasKeys()).toBe(true);
      expect(updated.getActive()?.id).toBe('c1');
    });

    test('replaces credential with same ID', () => {
      const empty = Credentials.createEmpty('creds-1');
      const cred1 = makeCredential('c1');
      const cred1b = makeCredential('c1', VALID_GROQ_KEY, 'groq');

      const step1 = empty.add(cred1);
      const step2 = step1.add(cred1b);

      expect(step2.items).toHaveLength(1);
      expect(step2.items[0].provider).toBe('groq');
    });

    test('adding multiple credentials keeps last as active', () => {
      const empty = Credentials.createEmpty('creds-1');
      const c1 = makeCredential('c1');
      const c2 = makeCredential('c2', VALID_GROQ_KEY, 'groq');

      const result = empty.add(c1).add(c2);
      expect(result.items).toHaveLength(2);
      expect(result.activeCredentialId).toBe('c2');
    });
  });

  describe('remove', () => {
    test('removes a credential by ID', () => {
      const cred = makeCredential('c1');
      const creds = Credentials.createEmpty('creds-1').add(cred);
      const removed = creds.remove('c1');

      expect(removed.items).toHaveLength(0);
      expect(removed.hasKeys()).toBe(false);
    });

    test('promotes next credential when active is removed', () => {
      const c1 = makeCredential('c1');
      const c2 = makeCredential('c2', VALID_GROQ_KEY, 'groq');
      const creds = Credentials.createEmpty('creds-1').add(c1).add(c2);

      const removed = creds.remove('c2');

      expect(removed.items).toHaveLength(1);
      expect(removed.activeCredentialId).toBe('c1');
    });

    test('sets active to null when last credential removed', () => {
      const c1 = makeCredential('c1');
      const creds = Credentials.createEmpty('creds-1').add(c1);

      const removed = creds.remove('c1');

      expect(removed.activeCredentialId).toBeNull();
    });
  });

  describe('setActive', () => {
    test('switches the active credential', () => {
      const c1 = makeCredential('c1');
      const c2 = makeCredential('c2', VALID_GROQ_KEY, 'groq');
      const creds = Credentials.createEmpty('creds-1').add(c1).add(c2);

      const result = creds.setActive('c1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activeCredentialId).toBe('c1');
      }
    });

    test('fails for unknown credential ID', () => {
      const creds = Credentials.createEmpty('creds-1').add(
        makeCredential('c1'),
      );

      const result = creds.setActive('nope');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
      }
    });
  });

  describe('getByProvider', () => {
    test('filters credentials by provider', () => {
      const g1 = makeCredential('g1');
      const q1 = makeCredential('q1', VALID_GROQ_KEY, 'groq');
      const creds = Credentials.createEmpty('creds-1').add(g1).add(q1);

      expect(creds.getByProvider('groq')).toHaveLength(1);
      expect(creds.getByProvider('groq')[0].id).toBe('q1');
      expect(creds.getByProvider('google')).toHaveLength(1);
    });
  });

  describe('getNextRoundRobin', () => {
    test('returns first key when no lastUsedId', () => {
      const g1 = makeCredential('g1');
      const g2 = makeCredential('g2', 'AIzaSyB1234567890abcdefghijklmnopqrstuv');
      const creds = Credentials.createEmpty('creds-1').add(g1).add(g2);

      expect(creds.getNextRoundRobin('google', null)?.id).toBe('g1');
    });

    test('advances to next key and wraps around', () => {
      const g1 = makeCredential('g1');
      const g2 = makeCredential('g2', 'AIzaSyB1234567890abcdefghijklmnopqrstuv');
      const creds = Credentials.createEmpty('creds-1').add(g1).add(g2);

      expect(creds.getNextRoundRobin('google', 'g1')?.id).toBe('g2');
      expect(creds.getNextRoundRobin('google', 'g2')?.id).toBe('g1');
    });

    test('returns null when provider has no keys', () => {
      const creds = Credentials.createEmpty('creds-1');
      expect(creds.getNextRoundRobin('google', null)).toBeNull();
    });
  });

  describe('fromProps', () => {
    test('reconstructs from valid props', () => {
      const result = Credentials.fromProps({
        id: 'creds-1',
        activeCredentialId: 'c1',
        items: [
          {
            id: 'c1',
            type: 'API_KEY',
            provider: 'google',
            apiKey: VALID_GOOGLE_KEY,
          },
          {
            id: 'c2',
            type: 'API_KEY',
            provider: 'groq',
            apiKey: VALID_GROQ_KEY,
          },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(2);
        expect(result.data.activeCredentialId).toBe('c1');
      }
    });

    test('fails on missing ID', () => {
      const result = Credentials.fromProps({
        id: '',
        activeCredentialId: null,
        items: [],
      });
      expect(result.success).toBe(false);
    });

    test('fails when active credential ID is not in items', () => {
      const result = Credentials.fromProps({
        id: 'creds-1',
        activeCredentialId: 'missing',
        items: [],
      });
      expect(result.success).toBe(false);
    });

    test('fails on invalid item', () => {
      const result = Credentials.fromProps({
        id: 'creds-1',
        activeCredentialId: null,
        items: [
          {
            id: '',
            type: 'API_KEY',
            provider: 'google',
            apiKey: VALID_GOOGLE_KEY,
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('toProps round-trip', () => {
    test('round-trips through fromProps', () => {
      const creds = Credentials.createEmpty('creds-1')
        .add(makeCredential('c1'))
        .add(makeCredential('c2', VALID_GROQ_KEY, 'groq'))
        .setActive('c1');
      if (!creds.success) throw new Error('bad state');

      const result = Credentials.fromProps(creds.data.toProps());

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(2);
        expect(result.data.activeCredentialId).toBe('c1');
      }
    });
  });
});
