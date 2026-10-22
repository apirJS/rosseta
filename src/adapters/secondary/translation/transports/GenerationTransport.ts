import type { EncodedImage } from '../../../../core/domain/image/EncodedImage';
import type { z } from 'zod';
import type { GenerationMode } from './generation-modes';

export interface ModelScopeInput {
  providerId: string;
  modelId: string;
  protocol: string;
  baseURL?: string;
  customConfig?: {
    id: string;
    type?: string;
    baseURL: string;
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
  };
}

export interface TranslationProviderContext extends ModelScopeInput {
  legacyUnambiguous?: boolean;
}

export interface ProviderRuntime {
  readonly transport: ITranslationGenerationTransport;
  readonly context: TranslationProviderContext;
}

/** Request controls have opaque identities outside their provider transport. */
export interface GenerationConfiguration {
  id: string;
  rejectionFields: readonly string[];
}

export type GenerationRoute = Readonly<{
  mode: GenerationMode;
  configurationId?: string;
}>;

export interface GenerationRequest {
  mode: GenerationMode;
  image: EncodedImage;
  instructions: string;
  userText: string;
  schema: z.ZodType;
  signal: AbortSignal;
  configurationId?: string;
}

export type GenerationEvent =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'partial';
      value: unknown;
    };

export interface GenerationResult {
  text: string;
  output?: unknown;
  finishReason: string;
  schemaValidated: boolean;
  validationError?: unknown;
}

/** The completed invocation's provenance survives later selection changes. */
export type AttemptReceipt = Readonly<{
  route: GenerationRoute;
  generated: GenerationResult;
  streamedText: string;
}>;

export interface ITranslationGenerationTransport {
  readonly supportedModes?: readonly GenerationMode[];
  readonly legacyModelKey?: string;
  readonly configurations?: readonly GenerationConfiguration[];
  generate(
    request: GenerationRequest,
    onEvent: (event: GenerationEvent) => Promise<void>,
  ): Promise<GenerationResult>;
}
