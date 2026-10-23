/* eslint-disable no-await-in-loop -- Each route depends on the preceding provider failure. */
import type { EncodedImage } from '../../../../core/domain/image/EncodedImage';
import type { Language } from '../../../../core/domain/translation/Language';
import type { ITranslationProgressObserver } from '../../../../core/ports/outbound/ITranslationProgressObserver';
import type { AppError } from '../../../../shared/errors';
import { failure, success, type Result } from '../../../../shared/types/Result';
import type { TranslationCapabilityState } from '../compatibility/TranslationCapabilityState';
import {
  classifyGenerationFailure,
  type GenerationFailure,
} from '../errors/classify-generation-failure';
import {
  buildBasePrompt,
  buildPlainPrompt,
  buildRepairPrompt,
} from '../output/prompt-base';
import { TranslationAttemptPreview } from '../preview/TranslationAttemptPreview';
import type {
  AttemptReceipt,
  GenerationRequest,
  GenerationResult,
  GenerationRoute,
  ITranslationGenerationTransport,
} from '../transports/GenerationTransport';
import {
  GENERATION_MODES,
  bufferedMode,
  isStreamed,
  isStructured,
} from '../transports/generation-modes';
import type { GenerationBudget } from './generation-budget';
import type { GenerationSelection } from './generation-selection';
import {
  throwIfAborted,
  type TranslationExecutionScope,
} from './translation-execution';

export type GenerationIntent =
  | { kind: 'initial' }
  | {
      kind: 'repair';
      previousResponse: string;
      previousRoute: GenerationRoute;
    };

/** Request inputs and the owners shared by initial generation and repair. */
export interface GenerationExecution {
  transport: ITranslationGenerationTransport;
  image: EncodedImage;
  targetLanguage: Language;
  includeDescription: boolean;
  schema: GenerationRequest['schema'];
  state: TranslationCapabilityState;
  selection: GenerationSelection;
  budget: GenerationBudget;
  scope: TranslationExecutionScope;
  progress?: ITranslationProgressObserver;
}

export type GenerationRunOutcome =
  | { kind: 'generated'; receipt: AttemptReceipt }
  | { kind: 'not-started'; reason: 'budget-exhausted' | 'no-eligible-route' }
  | { kind: 'failed'; error: AppError };

/** The only provider-attempt loop. Successful output is inspected by the caller. */
export async function generateWithFallback(
  execution: GenerationExecution,
  intent: GenerationIntent,
): Promise<GenerationRunOutcome> {
  const { budget, selection, scope } = execution;

  throwIfAborted(scope.signal);
  if (!budget.hasCapacity)
    return { kind: 'not-started', reason: 'budget-exhausted' };

  const declaredModes = execution.transport.supportedModes ?? GENERATION_MODES;

  const allowedModes =
    intent.kind === 'repair'
      ? declaredModes.filter((mode) => !isStreamed(mode))
      : declaredModes;

  let route = selection.beginPhase(
    allowedModes,
    intent.kind === 'repair'
      ? {
          preferredMode: 'plain-buffered',
          configurationFallbackMode: bufferedMode(intent.previousRoute.mode),
        }
      : undefined,
  );

  if (!route) return { kind: 'not-started', reason: 'no-eligible-route' };

  const userText =
    intent.kind === 'repair'
      ? buildRepairPrompt(intent.previousResponse)
      : 'Extract and translate all text in this image.';

  while (true) {
    throwIfAborted(scope.signal);

    // Local construction/reset failures must never enter provider classification.
    const request = createGenerationRequest(execution, route, userText);
    const reset = await execution.progress?.report({ kind: 'reset' });

    if (reset && !reset.success) return { kind: 'failed', error: reset.error };

    throwIfAborted(scope.signal);
    budget.recordInvocation();
    selection.recordAttempt(route.mode);

    const attempted = await invokeProvider(execution, route, request);

    throwIfAborted(scope.signal);

    if (attempted.success)
      return { kind: 'generated', receipt: attempted.data };

    const classified = attempted.error;

    // Observation I/O is outside the provider catch, even when storage fails.
    await recordRejection(execution.state, route, classified);
    throwIfAborted(scope.signal);

    if (!budget.hasCapacity) return { kind: 'failed', error: classified.error };

    const next = recoveryRoute(execution, route, classified);

    if (!next) return { kind: 'failed', error: classified.error };
    route = next;
  }
}

function createGenerationRequest(
  execution: GenerationExecution,
  route: GenerationRoute,
  userText: string,
): GenerationRequest {
  const prompt = {
    targetLanguageCode: execution.targetLanguage.code,
    targetLanguageName: execution.targetLanguage.name,
    includeDescription: execution.includeDescription,
  };

  return {
    ...route,
    image: execution.image,
    instructions: isStructured(route.mode)
      ? buildBasePrompt(prompt)
      : buildPlainPrompt(prompt),
    userText,
    schema: execution.schema,
    signal: execution.scope.signal,
  };
}

async function invokeProvider(
  execution: GenerationExecution,
  route: GenerationRoute,
  request: GenerationRequest,
): Promise<Result<AttemptReceipt, GenerationFailure>> {
  const preview = new TranslationAttemptPreview(
    route.mode,
    execution.scope,
    execution.progress,
  );

  let generated: GenerationResult;

  try {
    generated = await execution.transport.generate(request, (event) =>
      preview.receive(event),
    );
  } catch (error) {
    // A preview/delivery failure aborts locally, even if it looks like a network error.
    throwIfAborted(execution.scope.signal);

    return failure(
      classifyGenerationFailure(error, {
        mode: route.mode,
        configuration: execution.selection.currentConfiguration,
      }),
    );
  } finally {
    preview.dispose();
  }

  throwIfAborted(execution.scope.signal);

  return success({ route, generated, streamedText: preview.text });
}

async function recordRejection(
  state: TranslationCapabilityState,
  route: GenerationRoute,
  classified: GenerationFailure,
): Promise<void> {
  switch (classified.kind) {
    case 'configuration-rejected':
      return state.rejectedConfiguration(classified.configurationId);
    case 'configuration-mode-rejected':
      return state.rejectedConfigurationMode(
        classified.mode,
        classified.configurationId,
      );
    case 'feature-rejected':
      return state.rejected(route.mode, classified.feature, true);
    case 'mode-rejected':
      return state.rejected(classified.mode, 'combination');
    case 'terminal':
    case 'transient':
      return;
  }
}

function recoveryRoute(
  execution: GenerationExecution,
  route: GenerationRoute,
  classified: GenerationFailure,
): GenerationRoute | null {
  const { selection, budget } = execution;

  switch (classified.kind) {
    case 'terminal':
      return null;
    case 'configuration-rejected':
      return selection.afterConfigurationRejection(route.mode);
    case 'configuration-mode-rejected':
      return selection.afterModeRejection(route.mode, classified.reason, {
        advanceConfiguration: true,
      });
    case 'feature-rejected':
      return classified.feature === 'vision'
        ? null
        : selection.afterModeRejection(route.mode, classified.feature);
    case 'mode-rejected':
      return selection.afterModeRejection(route.mode, 'combination');
    case 'transient': {
      if (!budget.canRestart) return null;

      const next = selection.bufferedRestart(route.mode);

      if (next) budget.consumeRestart();

      return next;
    }
  }
}
