import type { EncodedImage } from '../../../core/domain/image/EncodedImage';
import type { z } from 'zod';
export type GenerationMode = 'structured-stream' | 'plain-stream' | 'structured-buffered' | 'plain-buffered';
export const GENERATION_MODES: readonly GenerationMode[] = ['structured-stream', 'plain-stream', 'structured-buffered', 'plain-buffered'];
export interface GenerationRequest {
    mode: GenerationMode;
    image: EncodedImage;
    instructions: string;
    userText: string;
    schema: z.ZodType;
    signal: AbortSignal;
}
export type GenerationEvent = {
    type: 'text';
    text: string;
} | {
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
export interface ITranslationGenerationTransport {
    readonly supportedModes?: readonly GenerationMode[];
    readonly legacyModelKey?: string;
    generate(request: GenerationRequest, onEvent: (event: GenerationEvent) => Promise<void>): Promise<GenerationResult>;
}
