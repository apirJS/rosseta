import { describe, expect, test } from 'bun:test';
import { MessageSchema, type Message, COMMAND } from './MessageSchema';

describe('Shared: MessageSchema', () => {
  // ==================== VALID MESSAGES ====================
  describe('valid messages', () => {
    test('PING', () => {
      const result = MessageSchema.safeParse({ action: 'PING' });
      expect(result.success).toBe(true);
    });

    test('PONG', () => {
      const result = MessageSchema.safeParse({ action: 'PONG' });
      expect(result.success).toBe(true);
    });

    test('START_OVERLAY', () => {
      const result = MessageSchema.safeParse({ action: 'START_OVERLAY' });
      expect(result.success).toBe(true);
    });

    test('MOUNT_OVERLAY with valid payload', () => {
      const result = MessageSchema.safeParse({
        action: 'MOUNT_OVERLAY',
        payload: { rawImage: 'data:image/png;base64,abc123' },
      });
      expect(result.success).toBe(true);
    });

    test('TRANSLATE_IMAGE with valid payload', () => {
      const result = MessageSchema.safeParse({
        action: 'TRANSLATE_IMAGE',
        payload: { imageBase64: 'data:image/png;base64,abc123' },
      });
      expect(result.success).toBe(true);
    });

    test('THEME_CHANGED with dark', () => {
      const result = MessageSchema.safeParse({
        action: 'THEME_CHANGED',
        payload: { theme: 'dark' },
      });
      expect(result.success).toBe(true);
    });

    test('THEME_CHANGED with light', () => {
      const result = MessageSchema.safeParse({
        action: 'THEME_CHANGED',
        payload: { theme: 'light' },
      });
      expect(result.success).toBe(true);
    });

    test('SHOW_TOAST with required fields', () => {
      const result = MessageSchema.safeParse({
        action: 'SHOW_TOAST',
        payload: {
          type: 'success',
          message: 'Done!',
        },
      });
      expect(result.success).toBe(true);
    });

    test('SHOW_TOAST with all optional fields', () => {
      const result = MessageSchema.safeParse({
        action: 'SHOW_TOAST',
        payload: {
          id: 'toast-1',
          type: 'loading',
          message: 'Translating...',
          description: 'Please wait',
          duration: 5000,
        },
      });
      expect(result.success).toBe(true);
    });

    test('DISMISS_TOAST with valid payload', () => {
      const result = MessageSchema.safeParse({
        action: 'DISMISS_TOAST',
        payload: { id: 'toast-1' },
      });
      expect(result.success).toBe(true);
    });

    test('MOUNT_TRANSLATION_MODAL with full payload', () => {
      const result = MessageSchema.safeParse({
        action: 'MOUNT_TRANSLATION_MODAL',
        payload: {
          id: 't-1',
          original: [
            {
              language: { code: 'ja-JP', name: 'Japanese' },
              text: 'こんにちは',
              romanization: 'konnichiwa',
            },
          ],
          translated: [
            {
              language: { code: 'en-US', name: 'English' },
              text: 'Hello',
              romanization: null,
            },
          ],
          description: 'A greeting',
          createdAt: '2026-02-15T00:00:00Z',
        },
      });
      expect(result.success).toBe(true);
    });

    test('MOUNT_HISTORY_MODAL with full payload', () => {
      const result = MessageSchema.safeParse({
        action: 'MOUNT_HISTORY_MODAL',
        payload: {
          id: 'h-1',
          original: [],
          translated: [],
          description: 'Empty translation',
          createdAt: new Date().toISOString(),
        },
      });
      expect(result.success).toBe(true);
    });

    test('SHOW_RESULT with valid payload', () => {
      const result = MessageSchema.safeParse({
        action: 'SHOW_RESULT',
        payload: {
          originalText: {
            contents: [
              { text: 'hello', languageCode: 'en', language: 'English' },
            ],
          },
          translatedText: {
            contents: [
              { text: 'hola', languageCode: 'es', language: 'Spanish' },
            ],
          },
        },
      });
      expect(result.success).toBe(true);
    });
  });

  // ==================== INVALID MESSAGES ====================
  describe('invalid messages', () => {
    test('rejects unknown action', () => {
      const result = MessageSchema.safeParse({ action: 'UNKNOWN_ACTION' });
      expect(result.success).toBe(false);
    });

    test('rejects missing action', () => {
      const result = MessageSchema.safeParse({ payload: {} });
      expect(result.success).toBe(false);
    });

    test('rejects MOUNT_OVERLAY without payload', () => {
      const result = MessageSchema.safeParse({ action: 'MOUNT_OVERLAY' });
      expect(result.success).toBe(false);
    });

    test('rejects MOUNT_OVERLAY with non-data-url image', () => {
      const result = MessageSchema.safeParse({
        action: 'MOUNT_OVERLAY',
        payload: { rawImage: 'https://example.com/image.png' },
      });
      expect(result.success).toBe(false);
    });

    test('rejects THEME_CHANGED with invalid theme', () => {
      const result = MessageSchema.safeParse({
        action: 'THEME_CHANGED',
        payload: { theme: 'blue' },
      });
      expect(result.success).toBe(false);
    });

    test('rejects SHOW_TOAST with invalid type', () => {
      const result = MessageSchema.safeParse({
        action: 'SHOW_TOAST',
        payload: { type: 'warning', message: 'test' },
      });
      expect(result.success).toBe(false);
    });

    test('rejects DISMISS_TOAST without id', () => {
      const result = MessageSchema.safeParse({
        action: 'DISMISS_TOAST',
        payload: {},
      });
      expect(result.success).toBe(false);
    });
  });

  // ==================== createdAt coercion ====================
  describe('date coercion', () => {
    test('MOUNT_TRANSLATION_MODAL coerces ISO string to Date', () => {
      const result = MessageSchema.safeParse({
        action: 'MOUNT_TRANSLATION_MODAL',
        payload: {
          id: 't-1',
          original: [],
          translated: [],
          description: 'test',
          createdAt: '2026-01-01T00:00:00Z',
        },
      });
      expect(result.success).toBe(true);
      if (result.success && result.data.action === 'MOUNT_TRANSLATION_MODAL') {
        expect(result.data.payload.createdAt).toBeInstanceOf(Date);
      }
    });
  });

  // ==================== COMMAND enum ====================
  describe('COMMAND enum', () => {
    test('START_EXTENSION is defined', () => {
      expect(COMMAND.START_EXTENSION).toBeDefined();
      expect(typeof COMMAND.START_EXTENSION).toBe('string');
    });
  });
});
