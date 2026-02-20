import { describe, expect, test } from 'bun:test';
import { Credentials } from './Credentials';
import { Credential } from './Credential';
import { ApiKey } from './ApiKey';
import { DomainError } from '../shared/DomainError';

const VALID_GEMINI_KEY = 'AIzaSyA1234567890abcdefghijklmnopqrstuv';
const VALID_GROQ_KEY = 'gsk_' + 'a'.repeat(52);

function makeCredential(
  id: string,
  raw: string = VALID_GEMINI_KEY,
): Credential {
  const apiKey = ApiKey.create(raw);
  if (!apiKey.success) throw new Error('Test helper: invalid API key');
  const cred = Credential.create(id, apiKey.data, apiKey.data.provider);
  if (!cred.success) throw new Error('Test helper: invalid credential');
  return cred.data;
}

describe('Domain: Credentials (Aggregate)', () => {
  // ==================== CREATE EMPTY ====================
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

  // ==================== ADD ====================
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
      const cred1b = makeCredential('c1', VALID_GROQ_KEY);

      const step1 = empty.add(cred1);
      const step2 = step1.add(cred1b);

      expect(step2.items).toHaveLength(1);
      expect(step2.items[0].provider).toBe('groq');
    });

    test('adding multiple credentials keeps last as active', () => {
      const empty = Credentials.createEmpty('creds-1');
      const c1 = makeCredential('c1');
      const c2 = makeCredential('c2', VALID_GROQ_KEY);

      const result = empty.add(c1).add(c2);
      expect(result.items).toHaveLength(2);
      expect(result.activeCredentialId).toBe('c2');
    });
  });

  // ==================== REMOVE ====================
  describe('remove', () => {
    test('removes a credential by ID', () => {
      const cred = makeCredential('c1');
      const creds = Credentials.createEmpty('creds-1').add(cred);
      const removed = creds.remove('c1');

      expect(removed.items).toHaveLength(0);
      expect(removed.hasKeys()).toBe(false);
    });

    test('falls back to first item when active is removed', () => {
      const c1 = makeCredential('c1');
      const c2 = makeCredential('c2', VALID_GROQ_KEY);
      const creds = Credentials.createEmpty('creds-1').add(c1).add(c2);

      // c2 is active; remove c2 → c1 becomes active
      const result = creds.remove('c2');
      expect(result.activeCredentialId).toBe('c1');
    });

    test('sets active to null when last item is removed', () => {
      const c1 = makeCredential('c1');
      const creds = Credentials.createEmpty('creds-1').add(c1).remove('c1');

      expect(creds.activeCredentialId).toBeNull();
      expect(creds.getActive()).toBeNull();
    });

    test('removing non-existent ID is a no-op', () => {
      const c1 = makeCredential('c1');
      const creds = Credentials.createEmpty('creds-1').add(c1);
      const result = creds.remove('nonexistent');

      expect(result.items).toHaveLength(1);
      expect(result.activeCredentialId).toBe('c1');
    });
  });

  // ==================== SET ACTIVE ====================
  describe('setActive', () => {
    test('switches active credential', () => {
      const c1 = makeCredential('c1');
      const c2 = makeCredential('c2', VALID_GROQ_KEY);
      const creds = Credentials.createEmpty('creds-1').add(c1).add(c2);

      const result = creds.setActive('c1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activeCredentialId).toBe('c1');
        expect(result.data.getActive()?.id).toBe('c1');
      }
    });

    test('fails when credential ID does not exist', () => {
      const c1 = makeCredential('c1');
      const creds = Credentials.createEmpty('creds-1').add(c1);

      const result = creds.setActive('nonexistent');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DomainError);
        expect(result.error.message).toContain('not found');
      }
    });
  });

  // ==================== FROM PROPS ====================
  describe('fromProps', () => {
    test('reconstructs from valid props', () => {
      const c1 = makeCredential('c1');
      const original = Credentials.createEmpty('creds-1').add(c1);
      const props = original.toProps();
      const result = Credentials.fromProps(props);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(1);
        expect(result.data.activeCredentialId).toBe('c1');
      }
    });

    test('fails with missing ID', () => {
      const result = Credentials.fromProps({
        id: '',
        activeCredentialId: null,
        items: [],
      });
      expect(result.success).toBe(false);
    });

    test('fails when activeCredentialId references non-existent item', () => {
      const result = Credentials.fromProps({
        id: 'creds-1',
        activeCredentialId: 'ghost',
        items: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not found');
      }
    });
  });

  // ==================== TO PROPS ROUND TRIP ====================
  describe('toProps', () => {
    test('round-trips through toProps/fromProps', () => {
      const c1 = makeCredential('c1');
      const c2 = makeCredential('c2', VALID_GROQ_KEY);
      const original = Credentials.createEmpty('creds-1').add(c1).add(c2);
      const props = original.toProps();
      const restored = Credentials.fromProps(props);

      expect(restored.success).toBe(true);
      if (restored.success) {
        expect(restored.data.items).toHaveLength(2);
        expect(restored.data.activeCredentialId).toBe('c2');
      }
    });
  });

  // ==================== GET BY PROVIDER ====================
  describe('getByProvider', () => {
    test('filters credentials by provider', () => {
      const g1 = makeCredential('g1');
      const g2 = makeCredential(
        'g2',
        'AIzaSyB1234567890abcdefghijklmnopqrstuv',
      );
      const q1 = makeCredential('q1', VALID_GROQ_KEY);
      const creds = Credentials.createEmpty('creds-1').add(g1).add(g2).add(q1);

      expect(creds.getByProvider('gemini')).toHaveLength(2);
      expect(creds.getByProvider('groq')).toHaveLength(1);
    });

    test('returns empty array when no keys for provider', () => {
      const g1 = makeCredential('g1');
      const creds = Credentials.createEmpty('creds-1').add(g1);

      expect(creds.getByProvider('groq')).toHaveLength(0);
    });
  });

  // ==================== GET NEXT ROUND ROBIN ====================
  describe('getNextRoundRobin', () => {
    test('returns first key when lastUsedId is null', () => {
      const g1 = makeCredential('g1');
      const g2 = makeCredential(
        'g2',
        'AIzaSyB1234567890abcdefghijklmnopqrstuv',
      );
      const creds = Credentials.createEmpty('creds-1').add(g1).add(g2);

      const next = creds.getNextRoundRobin('gemini', null);
      expect(next?.id).toBe('g1');
    });

    test('returns next key after lastUsedId', () => {
      const g1 = makeCredential('g1');
      const g2 = makeCredential(
        'g2',
        'AIzaSyB1234567890abcdefghijklmnopqrstuv',
      );
      const creds = Credentials.createEmpty('creds-1').add(g1).add(g2);

      const next = creds.getNextRoundRobin('gemini', 'g1');
      expect(next?.id).toBe('g2');
    });

    test('wraps around to first key at end of list', () => {
      const g1 = makeCredential('g1');
      const g2 = makeCredential(
        'g2',
        'AIzaSyB1234567890abcdefghijklmnopqrstuv',
      );
      const creds = Credentials.createEmpty('creds-1').add(g1).add(g2);

      const next = creds.getNextRoundRobin('gemini', 'g2');
      expect(next?.id).toBe('g1');
    });

    test('returns first key when lastUsedId not found', () => {
      const g1 = makeCredential('g1');
      const creds = Credentials.createEmpty('creds-1').add(g1);

      const next = creds.getNextRoundRobin('gemini', 'nonexistent');
      expect(next?.id).toBe('g1');
    });

    test('returns null when no keys for provider', () => {
      const g1 = makeCredential('g1');
      const creds = Credentials.createEmpty('creds-1').add(g1);

      const next = creds.getNextRoundRobin('groq', null);
      expect(next).toBeNull();
    });
  });
});
