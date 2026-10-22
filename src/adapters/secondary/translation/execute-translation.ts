/* eslint-disable no-await-in-loop -- Provider attempts depend on the preceding result. */
import { z } from 'zod';
import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { Translation } from '../../../core/domain/translation/Translation';
import type { Language } from '../../../core/domain/translation/Language';
import type { ITranslationCapabilityStorage } from '../../../core/ports/outbound/ITranslationCapabilityStorage';
import type { TranslationExecutionOptions } from '../../../core/ports/outbound/TranslationExecutionOptions';
import { failure, success, type Result } from '../../../shared/types/Result';
import { AppError, TranslationError } from '../../../shared/errors';
import {
  createTranslationDataSchema,
  type TranslationResponse,
} from './output/translation-schema';
import { mapResponseToDomain } from './output/translation-response-mapper';
import {
  buildBasePrompt,
  buildPlainPrompt,
  buildRepairPrompt,
} from './output/prompt-base';
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
import { TranslationAttemptPreview } from './preview/TranslationAttemptPreview';
import { TranslationConfigurationPolicy } from './execution/TranslationConfigurationPolicy';
import {
  isConfigurationModeConflict,
  isConfigurationRejection,
} from './execution/generation-configuration-error';
import { classifyGenerationError } from './execution/generation-errors';
import { inspectTranslationCompletion } from './output/translation-completion';
import {
  bufferedMode,
  isStructured,
  TranslationAttemptPolicy,
} from './execution/translation-fallback';
import {
  GENERATION_MODES,
  type GenerationMode,
  type GenerationRequest,
  type GenerationResult,
  type ITranslationGenerationTransport,
  type TranslationProviderContext,
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

interface PreparedTranslationJob extends TranslationJob {
  state: TranslationCapabilityState;
  schema: ReturnType<typeof createTranslationDataSchema>;
  configurations?: TranslationConfigurationPolicy;
}

/** Stable provider facade; each internal component owns one execution concern. */
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

  const job = {
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
    return failure(executionError(error, scope));
  } finally {
    scope.dispose();
  }
}

async function runTranslation(
  job: TranslationJob,
): Promise<Result<Translation, AppError>> {
  throwIfAborted(job.scope.signal);

  const prepared = await prepareTranslation(job);

  if (prepared.state.imageUnsupported())
    return failure(TranslationError.modelNoVision());

  const policy = new TranslationAttemptPolicy((mode) =>
    prepared.state.support(mode, prepared.configurations?.current?.id),
  );

  return runAttempts(prepared, policy);
}

async function prepareTranslation(
  job: TranslationJob,
): Promise<PreparedTranslationJob> {
  const identity = await modelScopeKey(job.context);
  const schema = createTranslationDataSchema(job.includeDescription);

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

  let configurations: TranslationConfigurationPolicy | undefined;

  if (job.transport.configurations?.length) {
    await state.declareConfigurations(
      job.transport.configurations.map((configuration) => configuration.id),
    );

    configurations = new TranslationConfigurationPolicy(
      job.transport.configurations,
      (id) => state.configurationSupport(id),
      (id) =>
        GENERATION_MODES.some(
          (mode) => state.support(mode, id) !== 'unsupported',
        ),
    );
  }

  return { ...job, state, schema, configurations };
}

async function runAttempts(
  job: PreparedTranslationJob,
  policy: TranslationAttemptPolicy,
): Promise<Result<Translation, AppError>> {
  let mode = policy.initialMode();

  while (mode && policy.hasBudget) {
    throwIfAborted(job.scope.signal);

    if (
      job.state.support(mode, job.configurations?.current?.id) === 'unsupported'
    )
      return failure(TranslationError.requestRejected());
    if (job.configurations && !job.configurations.current)
      return failure(TranslationError.requestRejected());

    const reset = await job.options.progress?.report({ kind: 'reset' });

    if (reset && !reset.success) return failure(reset.error);

    throwIfAborted(job.scope.signal);
    policy.recordAttempt(mode);

    try {
      const { generated, text } = await generateAttempt(
        job,
        mode,
        policy.repairText,
      );

      throwIfAborted(job.scope.signal);

      const completion = inspectTranslationCompletion(
        generated,
        text,
        job.includeDescription,
      );

      if (completion.kind === 'failed') return failure(completion.error);

      if (completion.kind === 'accepted') {
        return await acceptTranslation(
          job,
          mode,
          generated,
          completion.response,
        );
      }

      if (
        completion.finishReason !== 'stop' &&
        completion.finishReason !== 'length'
      ) {
        return failure(TranslationError.interrupted());
      }

      const firstRepair = policy.repairText === undefined;

      const repairMode =
        policy.repair(completion.text) ??
        (firstRepair
          ? advanceConfigurationMode(job, policy, bufferedMode(mode))
          : null);

      if (!repairMode) return failure(TranslationError.malformedResponse());

      mode = repairMode;
    } catch (error) {
      const fallback = await fallbackAfterFailure(job, policy, mode, error);

      if (!fallback.success) return failure(fallback.error);
      mode = fallback.data;
    }
  }

  return failure(TranslationError.requestRejected());
}

async function generateAttempt(
  job: PreparedTranslationJob,
  mode: GenerationMode,
  repairText?: string,
): Promise<{ generated: GenerationResult; text: string }> {
  const preview = new TranslationAttemptPreview(
    mode,
    job.scope,
    job.options.progress,
  );

  try {
    const request = createGenerationRequest(job, mode, repairText);

    const generated = await job.transport.generate(request, (event) =>
      preview.receive(event),
    );

    return { generated, text: preview.text };
  } finally {
    // Disposal also suppresses callbacks from old native readers after fallback.
    preview.dispose();
  }
}

function createGenerationRequest(
  job: PreparedTranslationJob,
  mode: GenerationMode,
  repairText?: string,
): GenerationRequest {
  const prompt = {
    targetLanguageCode: job.targetLanguage.code,
    targetLanguageName: job.targetLanguage.name,
    includeDescription: job.includeDescription,
  };

  return {
    mode,
    image: job.image,
    instructions: isStructured(mode)
      ? buildBasePrompt(prompt)
      : buildPlainPrompt(prompt),
    userText:
      repairText === undefined
        ? 'Extract and translate all text in this image.'
        : buildRepairPrompt(repairText),
    schema: job.schema,
    signal: job.scope.signal,
    configurationId: job.configurations?.current?.id,
  };
}

async function acceptTranslation(
  job: PreparedTranslationJob,
  mode: GenerationMode,
  generated: GenerationResult,
  response: TranslationResponse,
): Promise<Result<Translation, AppError>> {
  const imageAccepted = response.success && response.data !== null;
  const configuration = job.configurations?.current;

  if (configuration) await job.state.acceptedConfiguration(configuration.id);

  await job.state.accepted(
    mode,
    generated.schemaValidated,
    imageAccepted,
    configuration?.id,
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

async function fallbackAfterFailure(
  job: PreparedTranslationJob,
  policy: TranslationAttemptPolicy,
  mode: GenerationMode,
  error: unknown,
): Promise<Result<GenerationMode, AppError>> {
  throwIfAborted(job.scope.signal);

  const classified = classifyGenerationError(error, mode);
  const configuration = job.configurations?.current;

  if (
    configuration &&
    isConfigurationRejection(error, configuration.rejectionFields)
  ) {
    await job.state.rejectedConfiguration(configuration.id);
    throwIfAborted(job.scope.signal);

    const nextMode = advanceConfigurationMode(job, policy, mode);

    return nextMode ? success(nextMode) : failure(classified.error);
  }

  if (
    configuration &&
    isConfigurationModeConflict(error, configuration.rejectionFields)
  ) {
    await job.state.rejectedConfigurationMode(mode, configuration.id);
    throwIfAborted(job.scope.signal);

    const nextMode =
      policy.afterFailure(mode, {
        ...classified,
        unsupported: classified.unsupported ?? 'combination',
      }) ?? advanceConfigurationMode(job, policy, mode);

    return nextMode ? success(nextMode) : failure(classified.error);
  }

  if (classified.unsupported) {
    await job.state.rejected(mode, classified.unsupported, classified.general);
    throwIfAborted(job.scope.signal);
  }

  const nextMode = policy.afterFailure(mode, classified);

  return nextMode ? success(nextMode) : failure(classified.error);
}

function advanceConfigurationMode(
  job: PreparedTranslationJob,
  policy: TranslationAttemptPolicy,
  previousMode: GenerationMode,
): GenerationMode | null {
  if (!policy.hasBudget) return null;

  while (job.configurations?.advance()) {
    const mode = policy.afterConfigurationChange(previousMode);

    if (mode) return mode;
  }

  return null;
}

function executionError(
  error: unknown,
  scope: TranslationExecutionScope,
): AppError {
  if (scope.signal.aborted) {
    return scope.signal.reason instanceof AppError
      ? scope.signal.reason
      : scope.error();
  }

  return error instanceof AppError
    ? error
    : classifyGenerationError(error, 'plain-buffered').error;
}
