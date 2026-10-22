import { z } from 'zod';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { Translation } from '../../../core/domain/translation/Translation';
import type { Language } from '../../../core/domain/translation/Language';
import type { ITranslationCapabilityStorage } from '../../../core/ports/outbound/ITranslationCapabilityStorage';
import type { TranslationExecutionOptions } from '../../../core/ports/outbound/TranslationExecutionOptions';
import { failure, type Result } from '../../../shared/types/Result';
import { AppError, TranslationError } from '../../../shared/errors';
import { createGenerationResponseSchema } from './output/translation-schema';
import { mapResponseToDomain } from './output/translation-response-mapper';
import { inspectGenerationCompletion } from './output/inspect-generation-completion';
import {
  executionScope,
  raceAbort,
  throwIfAborted,
  type TranslationExecutionScope,
} from './execution/translation-execution';
import {
  modelScopeKey,
  capabilityDigest,
} from './compatibility/translation-capability-key';
import { TranslationCapabilityState } from './compatibility/TranslationCapabilityState';
import { GenerationBudget } from './execution/generation-budget';
import { GenerationSelection } from './execution/generation-selection';
import {
  generateWithFallback,
  type GenerationExecution,
} from './execution/generate-with-fallback';
import {
  repairTranslationResponse,
  type AcceptedGeneration,
} from './execution/repair-translation-response';
import type {
  ITranslationGenerationTransport,
  TranslationProviderContext,
} from './transports/GenerationTransport';

export type { TranslationProviderContext } from './transports/GenerationTransport';

const COMPATIBILITY_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

interface TranslationJob {
  transport: ITranslationGenerationTransport;
  context: TranslationProviderContext;
  image: EncodedImage;
  targetLanguage: Language;
  includeDescription: boolean;
  storage: ITranslationCapabilityStorage;
  options: TranslationExecutionOptions;
  scope: TranslationExecutionScope;
}

/** One translation owns one deadline, shared budget and optional repair phase. */
export async function executeTranslation(
  transport: ITranslationGenerationTransport,
  context: TranslationProviderContext,
  image: EncodedImage,
  targetLanguage: Language,
  includeDescription: boolean,
  storage: ITranslationCapabilityStorage,
  options: TranslationExecutionOptions = {},
): Promise<Result<Translation, AppError>> {
  const scope = executionScope(options);

  const job: TranslationJob = {
    transport,
    context,
    image,
    targetLanguage,
    includeDescription,
    storage,
    options,
    scope,
  };

  try {
    return await raceAbort(runTranslation(job), scope.signal);
  } catch (error) {
    // Provider interpretation belongs to the runner; local failures stay local.
    const reason = scope.signal.aborted ? scope.signal.reason : error;

    return failure(AppError.fromUnknown(reason));
  } finally {
    scope.dispose();
  }
}

async function runTranslation(
  job: TranslationJob,
): Promise<Result<Translation, AppError>> {
  throwIfAborted(job.scope.signal);

  const execution = await prepareExecution(job);

  if (execution.state.imageUnsupported())
    return failure(TranslationError.modelNoVision());

  const initial = await generateWithFallback(execution, { kind: 'initial' });

  throwIfAborted(job.scope.signal);

  if (initial.kind === 'failed') return failure(initial.error);
  if (initial.kind === 'not-started')
    return failure(TranslationError.requestRejected());

  const { receipt } = initial;

  const completion = inspectGenerationCompletion(
    receipt.generated,
    receipt.streamedText,
    job.includeDescription,
  );

  switch (completion.kind) {
    case 'failed':
      return failure(completion.error);
    case 'accepted':
      return acceptTranslation(job, execution.state, {
        receipt,
        response: completion.response,
      });
    case 'repairable': {
      const repaired = await repairTranslationResponse(execution, {
        previousResponse: completion.previousResponse,
        previousAttempt: receipt,
      });

      return repaired.success
        ? acceptTranslation(job, execution.state, repaired.data)
        : repaired;
    }
  }
}

async function prepareExecution(
  job: TranslationJob,
): Promise<GenerationExecution> {
  const identity = await modelScopeKey(job.context);
  const schema = createGenerationResponseSchema(job.includeDescription);

  const schemaScope = await capabilityDigest(
    z.toJSONSchema(schema, { target: 'draft-07', io: 'input' }),
  );

  throwIfAborted(job.scope.signal);

  const state = new TranslationCapabilityState(
    identity,
    schemaScope,
    job.storage,
    {
      namespace: job.context.providerId,
      refreshAfterMs: COMPATIBILITY_REFRESH_INTERVAL_MS,
    },
  );

  await state.load(
    job.transport.legacyModelKey,
    job.context.legacyUnambiguous ?? false,
  );

  throwIfAborted(job.scope.signal);

  if (job.transport.supportedModes)
    await state.declareModes(job.transport.supportedModes);

  const configurations = job.transport.configurations ?? [];

  if (configurations.length)
    await state.declareConfigurations(configurations.map(({ id }) => id));

  return {
    transport: job.transport,
    image: job.image,
    targetLanguage: job.targetLanguage,
    includeDescription: job.includeDescription,
    schema,
    state,
    selection: new GenerationSelection(
      configurations,
      (id) => state.configurationSupport(id),
      (mode, id) => state.support(mode, id),
    ),
    budget: new GenerationBudget(),
    scope: job.scope,
    progress: job.options.progress,
  };
}

async function acceptTranslation(
  job: TranslationJob,
  state: TranslationCapabilityState,
  { receipt, response }: AcceptedGeneration,
): Promise<Result<Translation, AppError>> {
  const { mode, configurationId } = receipt.route;

  throwIfAborted(job.scope.signal);

  if (configurationId) await state.acceptedConfiguration(configurationId);

  await state.accepted(
    mode,
    receipt.generated.schemaValidated,
    response.success && response.data !== null,
    configurationId,
  );

  throwIfAborted(job.scope.signal);

  if (!response.success || !response.data) {
    return failure(
      response.error === 'NO_TEXT_FOUND'
        ? TranslationError.noTextFound()
        : TranslationError.aiRejected(response.error ?? 'Unknown error'),
    );
  }

  return mapResponseToDomain(
    response.data,
    job.targetLanguage,
    job.context.providerId,
  );
}
