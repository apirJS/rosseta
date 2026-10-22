import { describe, expect, test } from 'bun:test';
import { GenerationBudget } from './generation-budget';

describe('Adapter: shared generation budget', () => {
  test('allows exactly six invocations across all generation phases', () => {
    const budget = new GenerationBudget();

    for (let call = 0; call < 6; call++) {
      expect(budget.hasCapacity).toBe(true);
      budget.recordInvocation();
    }

    expect(budget.hasCapacity).toBe(false);

    expect(() => budget.recordInvocation()).toThrow(
      'Generation budget exhausted',
    );

    expect(budget.hasCapacity).toBe(false);
  });

  test('retains a single transport restart independently of invocation counting', () => {
    const budget = new GenerationBudget();

    budget.recordInvocation();
    expect(budget.canRestart).toBe(true);
    budget.consumeRestart();
    budget.recordInvocation();
    expect(budget.canRestart).toBe(false);

    expect(() => budget.consumeRestart()).toThrow(
      'Transport restart already consumed',
    );

    // Repair and its fallbacks use the same counters; there is no phase reset.
    for (let call = 0; call < 4; call++) budget.recordInvocation();

    expect(budget.hasCapacity).toBe(false);
    expect(budget.canRestart).toBe(false);
  });

  test('scheduling a restart does not count a model invocation', () => {
    const budget = new GenerationBudget();

    budget.consumeRestart();

    for (let call = 0; call < 6; call++) {
      expect(budget.hasCapacity).toBe(true);
      budget.recordInvocation();
    }

    expect(budget.hasCapacity).toBe(false);
  });
});
