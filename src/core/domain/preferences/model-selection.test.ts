import { describe, expect, test } from 'bun:test';
import { resolveModelId } from './model-selection';

describe('Domain: explicit model selection', () => {
  test.each([
    ['saved', 'default', ['saved', 'default'], 'saved'],
    ['stale', 'default', ['first', 'default'], 'default'],
    ['stale', 'missing', ['first', 'second'], 'first'],
    [undefined, 'default', ['default'], 'default'],
    ['saved', 'default', [], 'saved'],
    [undefined, 'default', [], 'default'],
    [undefined, '', [], ''],
  ] as const)(
    'resolves saved %s and default %s from %j',
    (savedModelId, defaultModelId, ids, expected) => {
      expect(
        resolveModelId({
          savedModelId,
          defaultModelId,
          availableModels: ids.map((id) => ({ id })),
        }),
      ).toBe(expected);
    },
  );

  test('resolves identical model IDs independently for each provider snapshot', () => {
    const first = [{ id: 'shared' }, { id: 'first-only' }];
    const second = [{ id: 'shared' }, { id: 'second-only' }];

    expect(
      resolveModelId({
        savedModelId: 'first-only',
        defaultModelId: 'shared',
        availableModels: first,
      }),
    ).toBe('first-only');

    expect(
      resolveModelId({
        savedModelId: 'first-only',
        defaultModelId: 'shared',
        availableModels: second,
      }),
    ).toBe('shared');
  });
});
