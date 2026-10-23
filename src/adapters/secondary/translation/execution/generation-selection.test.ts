import { describe, expect, test } from 'bun:test';
import type { TranslationCapabilitySupport } from '../../../../core/ports/outbound/ITranslationCapabilityStorage';
import type { GenerationConfiguration } from '../transports/GenerationTransport';
import {
  GENERATION_MODES,
  type GenerationMode,
} from '../transports/generation-modes';
import { GenerationSelection } from './generation-selection';

const BUFFERED_MODES: readonly GenerationMode[] = [
  'structured-buffered',
  'plain-buffered',
];

const configurations: readonly GenerationConfiguration[] = [
  { id: 'disabled', rejectionFields: ['reasoning_effort'] },
  { id: 'minimum', rejectionFields: ['reasoning_effort'] },
  { id: 'default', rejectionFields: [] },
];

function selection(
  support: (
    mode: GenerationMode,
    configurationId?: string,
  ) => TranslationCapabilitySupport = () => 'unknown',
  profiles: readonly GenerationConfiguration[] = [],
  profileSupport: (id: string) => TranslationCapabilitySupport = () =>
    'unknown',
) {
  return new GenerationSelection(profiles, profileSupport, support);
}

describe('Adapter: generation route selection', () => {
  test('uses the original mode order without a declared configuration', () => {
    const routes = selection();

    expect(routes.beginPhase(GENERATION_MODES)).toEqual({
      mode: 'structured-stream',
    });

    expect(routes.currentConfiguration).toBeUndefined();
  });

  test('starts in a known working buffered mode before unknown streaming', () => {
    const routes = selection((mode) =>
      mode === 'plain-buffered' ? 'supported' : 'unknown',
    );

    expect(routes.beginPhase(GENERATION_MODES)).toEqual({
      mode: 'plain-buffered',
    });
  });

  test('chooses supported configurations before unknown ones, then chooses a mode', () => {
    const routes = selection(
      (mode, id) =>
        id === 'disabled' && mode === 'plain-stream' ? 'supported' : 'unknown',
      configurations,
      (id) => (id === 'minimum' ? 'supported' : 'unknown'),
    );

    expect(routes.beginPhase(GENERATION_MODES)).toEqual({
      mode: 'structured-stream',
      configurationId: 'minimum',
    });
  });

  test('skips rejected configurations and profiles with no locally eligible mode', () => {
    const routes = selection(
      (_mode, id) => (id === 'minimum' ? 'unsupported' : 'unknown'),
      configurations,
      (id) => (id === 'disabled' ? 'unsupported' : 'unknown'),
    );

    expect(routes.beginPhase(GENERATION_MODES)).toEqual({
      mode: 'structured-stream',
      configurationId: 'default',
    });
  });

  test('does not create an implicit default after declared configurations are exhausted', () => {
    const routes = selection(() => 'unknown', configurations);

    routes.beginPhase(['plain-stream']);

    expect(routes.afterConfigurationRejection('plain-stream')).toEqual({
      mode: 'plain-stream',
      configurationId: 'minimum',
    });

    expect(routes.afterConfigurationRejection('plain-stream')).toEqual({
      mode: 'plain-stream',
      configurationId: 'default',
    });

    expect(routes.afterConfigurationRejection('plain-stream')).toBeNull();
    expect(routes.beginPhase(BUFFERED_MODES)).toBeNull();
  });

  test('retains the current eligible mode after a configuration change', () => {
    const routes = selection(
      (mode, id) =>
        id === 'minimum' && mode === 'structured-buffered'
          ? 'supported'
          : 'unknown',
      configurations,
    );

    routes.beginPhase(GENERATION_MODES);
    routes.recordAttempt('plain-stream');

    expect(routes.afterConfigurationRejection('plain-stream')).toEqual({
      mode: 'plain-stream',
      configurationId: 'minimum',
    });
  });

  test('changing configuration reopens tried modes and skips its cached conflict', () => {
    const routes = selection(
      (mode, id) =>
        id === 'minimum' && mode === 'plain-stream' ? 'unsupported' : 'unknown',
      configurations,
    );

    routes.beginPhase(GENERATION_MODES);
    routes.recordAttempt('structured-stream');
    routes.recordAttempt('plain-stream');

    expect(routes.afterConfigurationRejection('plain-stream')).toEqual({
      mode: 'structured-stream',
      configurationId: 'minimum',
    });
  });

  test('prefers a known working mode over a fallback preference', () => {
    const routes = selection((mode) =>
      mode === 'plain-buffered' ? 'supported' : 'unknown',
    );

    routes.beginPhase(GENERATION_MODES);
    routes.recordAttempt('structured-stream');

    expect(routes.afterModeRejection('structured-stream', 'stream')).toEqual({
      mode: 'plain-buffered',
    });
  });

  test('a stream rejection prefers the corresponding unknown buffered mode', () => {
    const routes = selection();

    routes.beginPhase(GENERATION_MODES);
    routes.recordAttempt('structured-stream');

    expect(routes.afterModeRejection('structured-stream', 'stream')).toEqual({
      mode: 'structured-buffered',
    });
  });

  test.each(['structured', 'combination'] as const)(
    '%s rejection prefers plain output with the same streaming form',
    (reason) => {
      const routes = selection();

      routes.beginPhase(GENERATION_MODES);
      routes.recordAttempt('structured-stream');

      expect(routes.afterModeRejection('structured-stream', reason)).toEqual({
        mode: 'plain-stream',
      });
    },
  );

  test('capability discovery does not revisit an already attempted mode', () => {
    const routes = selection();

    routes.beginPhase(GENERATION_MODES);
    routes.recordAttempt('structured-stream');
    routes.recordAttempt('plain-stream');

    expect(
      routes.afterModeRejection('structured-stream', 'structured'),
    ).toEqual({
      mode: 'structured-buffered',
    });
  });

  test('general mode rejection never enumerates the remaining configurations', () => {
    const routes = selection(() => 'unknown', configurations);

    routes.beginPhase(['plain-stream']);
    routes.recordAttempt('plain-stream');
    expect(routes.afterModeRejection('plain-stream', 'stream')).toBeNull();
    expect(routes.currentConfiguration?.id).toBe('disabled');
  });

  test('a profile-mode conflict tries modes before advancing configuration', () => {
    const routes = selection(() => 'unknown', configurations);

    routes.beginPhase(['plain-stream', 'plain-buffered']);
    routes.recordAttempt('plain-stream');

    expect(
      routes.afterModeRejection('plain-stream', 'stream', {
        advanceConfiguration: true,
      }),
    ).toEqual({ mode: 'plain-buffered', configurationId: 'disabled' });

    routes.recordAttempt('plain-buffered');

    expect(
      routes.afterModeRejection('plain-buffered', 'combination', {
        advanceConfiguration: true,
      }),
    ).toEqual({ mode: 'plain-buffered', configurationId: 'minimum' });
  });

  test('a buffered restart can repeat a visited route without changing configuration', () => {
    const routes = selection(
      (mode) => (mode === 'plain-buffered' ? 'supported' : 'unknown'),
      configurations,
    );

    routes.beginPhase(GENERATION_MODES);
    routes.recordAttempt('structured-buffered');

    expect(routes.bufferedRestart('structured-buffered')).toEqual({
      mode: 'structured-buffered',
      configurationId: 'disabled',
    });
  });

  test('restart alternatives respect unsupported and previously visited routes', () => {
    const unsupported = new Set<GenerationMode>(['structured-buffered']);

    const routes = selection((mode) =>
      unsupported.has(mode) ? 'unsupported' : 'unknown',
    );

    routes.beginPhase(GENERATION_MODES);
    routes.recordAttempt('structured-stream');

    expect(routes.bufferedRestart('structured-stream')).toEqual({
      mode: 'plain-buffered',
    });

    routes.recordAttempt('plain-buffered');
    expect(routes.bufferedRestart('structured-stream')).toBeNull();
    unsupported.add('plain-buffered');

    expect(
      routes.beginPhase(BUFFERED_MODES, { preferredMode: 'plain-buffered' }),
    ).toBeNull();
  });

  test('transport-declared streaming-only eligibility cannot restart buffered', () => {
    const routes = selection();

    routes.beginPhase(['plain-stream']);
    routes.recordAttempt('plain-stream');
    expect(routes.bufferedRestart('plain-stream')).toBeNull();
  });

  test('beginning repair clears mode history and prefers a known working buffered mode', () => {
    const routes = selection((mode) =>
      mode === 'structured-buffered' ? 'supported' : 'unknown',
    );

    routes.beginPhase(GENERATION_MODES);
    routes.recordAttempt('structured-buffered');

    expect(
      routes.beginPhase(BUFFERED_MODES, { preferredMode: 'plain-buffered' }),
    ).toEqual({ mode: 'structured-buffered' });
  });

  test('repair configuration changes retain buffered eligibility and configuration history', () => {
    const routes = selection(
      (mode, id) =>
        id === 'minimum' && mode === 'plain-buffered'
          ? 'unsupported'
          : 'unknown',
      configurations,
    );

    routes.beginPhase(GENERATION_MODES);
    routes.afterConfigurationRejection('structured-stream');

    expect(
      routes.beginPhase(BUFFERED_MODES, { preferredMode: 'plain-buffered' }),
    ).toEqual({ mode: 'structured-buffered', configurationId: 'minimum' });

    routes.recordAttempt('structured-buffered');

    expect(routes.afterConfigurationRejection('structured-buffered')).toEqual({
      mode: 'structured-buffered',
      configurationId: 'default',
    });

    expect(
      routes.afterConfigurationRejection('structured-buffered'),
    ).toBeNull();
  });

  test('repair can advance configuration and retain the prior buffered counterpart', () => {
    const routes = selection((mode, id) => {
      if (id === 'disabled' && BUFFERED_MODES.includes(mode))
        return 'unsupported';
      if (id === 'minimum' && mode === 'plain-buffered') return 'supported';

      return 'unknown';
    }, configurations);

    routes.beginPhase(GENERATION_MODES);

    expect(
      routes.beginPhase(BUFFERED_MODES, {
        preferredMode: 'plain-buffered',
        configurationFallbackMode: 'structured-buffered',
      }),
    ).toEqual({ mode: 'structured-buffered', configurationId: 'minimum' });
  });

  test('mode compatibility is rechecked live after changing profiles', () => {
    const routes = selection(
      (mode, id) =>
        id === 'disabled' && mode === 'plain-stream'
          ? 'unsupported'
          : 'unknown',
      configurations,
    );

    routes.beginPhase(['plain-stream', 'plain-buffered']);

    expect(routes.afterConfigurationRejection('plain-stream')).toEqual({
      mode: 'plain-stream',
      configurationId: 'minimum',
    });
  });

  test('mode compatibility is rechecked after recording a rejection', () => {
    const unsupported = new Set<GenerationMode>();

    const routes = selection((mode) =>
      unsupported.has(mode) ? 'unsupported' : 'unknown',
    );

    routes.beginPhase(GENERATION_MODES);
    routes.recordAttempt('structured-stream');
    unsupported.add('plain-stream');

    expect(
      routes.afterModeRejection('structured-stream', 'structured'),
    ).toEqual({
      mode: 'structured-buffered',
    });
  });

  test('returns no route when every declared configuration is rejected', () => {
    const routes = selection(
      () => 'unknown',
      configurations,
      () => 'unsupported',
    );

    expect(routes.beginPhase(GENERATION_MODES)).toBeNull();
    expect(routes.currentConfiguration).toBeUndefined();
  });
});
