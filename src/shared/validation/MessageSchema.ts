import * as z from 'zod';

export const MessageSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('MOUNT_OVERLAY'),
    payload: z.object({
      rawImage: z.string().startsWith('data:image/'),
    }),
  }),
  z.object({
    action: z.literal('TRANSLATE_IMAGE'),
    payload: z.object({
      imageBase64: z.string(),
    }),
  }),
  z.object({
    action: z.literal('SHOW_RESULT'),
    payload: z.object({
      originalText: z.object({
        contents: z.array(
          z.object({
            text: z.string(),
            languageCode: z.string(),
            language: z.string(),
          }),
        ),
      }),
      translatedText: z.object({
        contents: z.array(
          z.object({
            text: z.string(),
            languageCode: z.string(),
            language: z.string(),
          }),
        ),
      }),
    }),
  }),
  z.object({
    action: z.literal('MOUNT_TRANSLATION_MODAL'),
    payload: z.object({
      id: z.string(),
      original: z.array(
        z.object({
          language: z.object({
            code: z.string(),
            name: z.string(),
          }),
          text: z.string(),
          romanization: z.string().nullable(),
        }),
      ),
      translated: z.array(
        z.object({
          language: z.object({
            code: z.string(),
            name: z.string(),
          }),
          text: z.string(),
          romanization: z.string().nullable(),
        }),
      ),
      description: z.string(),
      createdAt: z.coerce.date(),
    }),
  }),
  z.object({
    action: z.literal('THEME_CHANGED'),
    payload: z.object({
      theme: z.enum(['dark', 'light']),
    }),
  }),
  z.object({
    action: z.literal('START_OVERLAY'),
  }),
  z.object({
    action: z.literal('MOUNT_HISTORY_MODAL'),
    payload: z.object({
      id: z.string(),
      original: z.array(
        z.object({
          language: z.object({
            code: z.string(),
            name: z.string(),
          }),
          text: z.string(),
          romanization: z.string().nullable(),
        }),
      ),
      translated: z.array(
        z.object({
          language: z.object({
            code: z.string(),
            name: z.string(),
          }),
          text: z.string(),
          romanization: z.string().nullable(),
        }),
      ),
      description: z.string(),
      createdAt: z.coerce.date(),
    }),
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
    payload: z.object({
      id: z.string(),
    }),
  }),
  z.object({
    action: z.literal('PING'),
  }),
  z.object({
    action: z.literal('PONG'),
  }),
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
  TRANSLATE_IMAGE: void;
  SHOW_RESULT: void;
  MOUNT_TRANSLATION_MODAL: void;
  THEME_CHANGED: void;
  START_OVERLAY: void;
  MOUNT_HISTORY_MODAL: void;
  SHOW_TOAST: void;
  DISMISS_TOAST: void;
}

export enum COMMAND {
  START_EXTENSION = 'START_EXTENSION',
}
