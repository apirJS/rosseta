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
} from './translation-schema';
import { mapResponseToDomain } from './translation-response-mapper';
import {
  buildBasePrompt,
  buildPlainPrompt,
  buildRepairPrompt,
} from './prompt-base';
import {
  executionScope,
  raceAbort,
  throwIfAborted,
  type TranslationExecutionScope,
} from './translation-execution';
import {
  modelScopeKey,
  capabilityDigest,
  type ModelScopeInput,
} from './translation-capability-key';
import { TranslationCapabilityState } from './TranslationCapabilityState';
import { TranslationAttemptPreview } from './TranslationAttemptPreview';
import { TranslationConfigurationPolicy } from './TranslationConfigurationPolicy';
import { isConfigurationRejection } from './generation-configuration-error';
import { classifyGenerationError } from './generation-errors';
import { inspectTranslationCompletion } from './translation-completion';
import { isStructured, TranslationAttemptPolicy } from './translation-fallback';
import type {
  GenerationMode,
  GenerationRequest,
  GenerationResult,
  ITranslationGenerationTransport,
} from './ITranslationGenerationTransport';

export interface TranslationProviderContext extends ModelScopeInput {
  legacyUnambiguous?: boolean;
}

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
  const prepared = await prepareTranslation(job);
  if (prepared.state.imageUnsupported())
    return failure(TranslationError.modelNoVision());
  const policy = new TranslationAttemptPolicy((mode) =>
    prepared.state.support(mode),
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
    if (job.state.support(mode) === 'unsupported')
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

      const repairMode = policy.repair(completion.text);
      if (!repairMode) return failure(TranslationError.malformedResponse());
      if (
        completion.finishReason !== 'stop' &&
        completion.finishReason !== 'length'
      ) {
        return failure(TranslationError.interrupted());
      }
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
  await job.state.accepted(mode, generated.schemaValidated, imageAccepted);
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
    return job.configurations?.rejectCurrent()
      ? success(mode)
      : failure(classified.error);
  }
  if (classified.unsupported) {
    await job.state.rejected(mode, classified.unsupported, classified.general);
    throwIfAborted(job.scope.signal);
  }
  const nextMode = policy.afterFailure(mode, classified);
  return nextMode ? success(nextMode) : failure(classified.error);
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
