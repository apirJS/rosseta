import { describe, expect, test } from 'bun:test';
import { NetworkError, TranslationError } from '../../../../shared/errors';
import type { GenerationMode } from '../transports/GenerationTransport';
import { TranslationAttemptPolicy } from './translation-fallback';

const transient = { error: NetworkError.connectionFailed(), transient: true };

describe('Adapter: translation attempt policy', () => {
  test('starts directly in a known working buffered mode before exploring unknown streaming', () => {
    const policy = new TranslationAttemptPolicy((mode) =>
      mode === 'plain-buffered' ? 'supported' : 'unknown',
    );

    expect(policy.initialMode()).toBe('plain-buffered');
  });

  test('permits one buffered transport restart while retaining a separate bounded repair', () => {
    const policy = new TranslationAttemptPolicy(() => 'unknown');

    policy.recordAttempt('structured-stream');

    expect(policy.afterFailure('structured-stream', transient)).toBe(
      'structured-buffered',
    );

    policy.recordAttempt('structured-buffered');
    expect(policy.afterFailure('structured-buffered', transient)).toBeNull();
    expect(policy.repair('malformed response')).toBe('plain-buffered');
    expect(policy.repairText).toBe('malformed response');
    expect(policy.repair('another malformed response')).toBeNull();
    expect(policy.afterFailure('plain-buffered', transient)).toBeNull();
  });

  test('all restart and repair routes honor known unsupported buffered combinations', () => {
    const unsupported = new Set<GenerationMode>(['structured-buffered']);

    const policy = new TranslationAttemptPolicy((mode) =>
      unsupported.has(mode) ? 'unsupported' : 'unknown',
    );

    policy.recordAttempt('structured-stream');

    expect(policy.afterFailure('structured-stream', transient)).toBe(
      'plain-buffered',
    );

    unsupported.add('plain-buffered');
    expect(policy.repair('malformed')).toBeNull();
  });

  test('capability discovery does not revisit an already attempted mode', () => {
    const policy = new TranslationAttemptPolicy(() => 'unknown');

    policy.recordAttempt('structured-stream');
    policy.recordAttempt('plain-stream');

    const rejection = {
      error: TranslationError.requestRejected(),
      unsupported: 'structured' as const,
      transient: false,
    };

    expect(policy.afterFailure('structured-stream', rejection)).toBe(
      'structured-buffered',
    );
  });
});
