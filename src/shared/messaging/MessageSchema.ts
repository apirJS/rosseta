import * as z from 'zod';
import type { StoredModel } from '../../core/ports/outbound/IModelStorage';
import type { Result } from '../types/Result';
import type { TranslationModalPayload } from '../types/TranslationModalPayload';

export interface SafeRuntimeError {
  code: string;
  message: string;
  userMessage: string;
}
export interface SafeTranslationError {
  code: string;
  title: string;
  userMessage: string;
}
export type RuntimeActionResult = Result<void, SafeRuntimeError>;
export interface FetchModelsResponse {
  success: boolean;
  models?: StoredModel[];
  error?: SafeRuntimeError;
}

const identity = {
  requestId: z.string().min(1),
  documentSessionId: z.string().min(1),
};

const language = z.object({ code: z.string(), name: z.string() });

const segment = z.object({
  language,
  text: z.string(),
  romanization: z.string().nullable(),
  blockIndex: z.number().int().nonnegative(),
});

export const TranslationModalPayloadSchema = z.object({
  id: z.string(),
  original: z.array(segment),
  translated: z.array(segment),
  description: z.string(),
  createdAt: z.coerce.date(),
});

const draft = z.object({
  segments: z
    .array(
      z.object({
        index: z.number().int().nonnegative(),
        blockIndex: z.number().int().nonnegative().nullable(),
        originalText: z.string(),
        translatedText: z.string(),
        sourceLanguageCode: z.string().nullable(),
        romanization: z.string().nullable(),
      }),
    )
    .max(2048),
  description: z.string().nullable(),
});

const safeError = z.object({
  code: z.string(),
  title: z.string(),
  userMessage: z.string(),
});

const envelope = {
  ...identity,
  revision: z.number().int().nonnegative(),
  sequence: z.number().int().nonnegative(),
};

export const TranslationEventSchema = z.discriminatedUnion('kind', [
  z.object({
    ...envelope,
    kind: z.literal('started'),
    targetLanguage: language,
    generationDeadlineAt: z.number().finite(),
  }),
  z.object({ ...envelope, kind: z.literal('reset') }),
  z.object({ ...envelope, kind: z.literal('snapshot'), draft }),
  z.object({ ...envelope, kind: z.literal('committing') }),
  z.object({
    ...envelope,
    kind: z.literal('completed'),
    translation: TranslationModalPayloadSchema,
    historySaved: z.boolean(),
  }),
  z.object({ ...envelope, kind: z.literal('failed'), error: safeError }),
  z.object({ ...envelope, kind: z.literal('cancelled') }),
]);
export interface TranslationRequestIdentity {
  requestId: string;
  documentSessionId: string;
}
export type TranslationEvent = z.infer<typeof TranslationEventSchema>;
export interface TranslationAcknowledgement {
  status: 'accepted' | 'closed' | 'unknown' | 'stale';
}
export type TranslationStatusResponse =
  | { state: 'active' | 'committing' }
  | {
      state: 'completed';
      translation: TranslationModalPayload;
      historySaved: boolean;
    }
  | { state: 'completed-unavailable'; error?: SafeTranslationError }
  | { state: 'failed'; error: SafeTranslationError }
  | { state: 'cancelled' | 'unknown' };

export const MessageSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('MOUNT_OVERLAY'),
    payload: z.object({ rawImage: z.string().startsWith('data:image/') }),
  }),
  z.object({
    action: z.literal('TRANSLATE_IMAGE'),
    payload: z.object({ ...identity, imageBase64: z.string() }),
  }),
  z.object({
    action: z.literal('TRANSLATION_EVENT'),
    payload: TranslationEventSchema,
  }),
  z.object({
    action: z.literal('GET_TRANSLATION_STATUS'),
    payload: z.object(identity),
  }),
  z.object({
    action: z.literal('CANCEL_TRANSLATION'),
    payload: z.object(identity),
  }),
  z.object({
    action: z.literal('MOUNT_TRANSLATION_MODAL'),
    payload: TranslationModalPayloadSchema,
  }),
  z.object({
    action: z.literal('MOUNT_HISTORY_MODAL'),
    payload: TranslationModalPayloadSchema,
  }),
  z.object({
    action: z.literal('THEME_CHANGED'),
    payload: z.object({ theme: z.enum(['dark', 'light']) }),
  }),
  z.object({ action: z.literal('START_OVERLAY') }),
  z.object({
    action: z.literal('FETCH_MODELS'),
    payload: z.object({ provider: z.string().min(1) }),
  }),
  z.object({
    action: z.literal('SHOW_TOAST'),
    payload: z.object({
      id: z.string().optional(),
      type: z.enum(['loading', 'success', 'error', 'info']),
      message: z.string(),
      description: z.string().optional(),
      duration: z.number().optional(),
    }),
  }),
  z.object({
    action: z.literal('DISMISS_TOAST'),
    payload: z.object({ id: z.string() }),
  }),
  z.object({ action: z.literal('PING') }),
  z.object({ action: z.literal('PONG') }),
]);

export type Message = z.infer<typeof MessageSchema>;
export type MessageByAction<T extends Message['action']> = Extract<
  Message,
  { action: T }
>;
export interface MessageReturnTypeMap {
  PING: MessageByAction<'PONG'>;
  PONG: void;
  MOUNT_OVERLAY: void;
  TRANSLATE_IMAGE: RuntimeActionResult;
  TRANSLATION_EVENT: TranslationAcknowledgement;
  GET_TRANSLATION_STATUS: TranslationStatusResponse;
  CANCEL_TRANSLATION: void;
  MOUNT_TRANSLATION_MODAL: void;
  THEME_CHANGED: void;
  START_OVERLAY: void;
  FETCH_MODELS: FetchModelsResponse;
  MOUNT_HISTORY_MODAL: void;
  SHOW_TOAST: void;
  DISMISS_TOAST: void;
}

export enum COMMAND {
  START_EXTENSION = 'START_EXTENSION',
}
