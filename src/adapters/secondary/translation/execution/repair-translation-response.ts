import { TranslationError, type AppError } from '../../../../shared/errors';
import { failure, success, type Result } from '../../../../shared/types/Result';
import { inspectGenerationCompletion } from '../output/inspect-generation-completion';
import type { NormalizedTranslationResponse } from '../output/translation-schema';
import type { AttemptReceipt } from '../transports/GenerationTransport';
import {
  generateWithFallback,
  type GenerationExecution,
} from './generate-with-fallback';
import { throwIfAborted } from './translation-execution';

interface RepairInput {
  previousResponse: string;
  previousAttempt: AttemptReceipt;
}

export interface AcceptedGeneration {
  receipt: AttemptReceipt;
  response: NormalizedTranslationResponse;
}

/** One repair phase; malformed repair output is terminal, never recursive. */
export async function repairTranslationResponse(
  execution: GenerationExecution,
  input: RepairInput,
): Promise<Result<AcceptedGeneration, AppError>> {
  const repaired = await generateWithFallback(execution, {
    kind: 'repair',
    previousResponse: input.previousResponse,
    previousRoute: input.previousAttempt.route,
  });

  throwIfAborted(execution.scope.signal);

  if (repaired.kind === 'failed') return failure(repaired.error);
  if (repaired.kind === 'not-started')
    return failure(TranslationError.malformedResponse());

  const { receipt } = repaired;

  const completion = inspectGenerationCompletion(
    receipt.generated,
    receipt.streamedText,
    execution.includeDescription,
  );

  switch (completion.kind) {
    case 'accepted':
      return success({ receipt, response: completion.response });
    case 'failed':
      return failure(completion.error);
    case 'repairable':
      return failure(TranslationError.malformedResponse());
  }
}
