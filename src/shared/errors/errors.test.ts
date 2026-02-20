import { describe, expect, test } from 'bun:test';
import {
  AppError,
  AuthError,
  TranslationError,
  NetworkError,
  StorageError,
  BrowserError,
  ErrorCode,
  ERROR_MESSAGES,
} from './index';

// =============================================================
// AppError (base class)
// =============================================================
describe('Shared: AppError', () => {
  test('constructs with code and default message', () => {
    const error = new AppError({ code: ErrorCode.UNKNOWN_ERROR });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('AppError');
    expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(error.message).toBe(ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR]);
    expect(error.userMessage).toBe(ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR]);
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  test('accepts custom message', () => {
    const error = new AppError({
      code: ErrorCode.UNKNOWN_ERROR,
      message: 'custom msg',
    });

    expect(error.message).toBe('custom msg');
    // userMessage always comes from ERROR_MESSAGES map
    expect(error.userMessage).toBe(ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR]);
  });

  test('stores context', () => {
    const error = new AppError({
      code: ErrorCode.UNKNOWN_ERROR,
      context: { key: 'foo', count: 3 },
    });

    expect(error.context).toEqual({ key: 'foo', count: 3 });
  });

  test('stores cause', () => {
    const cause = new Error('root cause');
    const error = new AppError({
      code: ErrorCode.UNKNOWN_ERROR,
      cause,
    });

    expect(error.cause).toBe(cause);
  });

  // ---------- fromUnknown ----------
  describe('fromUnknown()', () => {
    test('returns same instance for AppError input', () => {
      const original = new AppError({ code: ErrorCode.UNKNOWN_ERROR });
      const result = AppError.fromUnknown(original);

      expect(result).toBe(original);
    });

    test('wraps a regular Error', () => {
      const cause = new Error('oops');
      const result = AppError.fromUnknown(cause);

      expect(result).toBeInstanceOf(AppError);
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(result.message).toBe('oops');
      expect(result.cause).toBe(cause);
    });

    test('wraps a string', () => {
      const result = AppError.fromUnknown('something broke');

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('something broke');
    });

    test('uses custom fallback code', () => {
      const result = AppError.fromUnknown(
        'bad request',
        ErrorCode.VALIDATION_INVALID_INPUT,
      );

      expect(result.code).toBe(ErrorCode.VALIDATION_INVALID_INPUT);
    });
  });

  // ---------- is() ----------
  test('is() matches exact code', () => {
    const error = new AppError({ code: ErrorCode.STORAGE_READ_FAILED });

    expect(error.is(ErrorCode.STORAGE_READ_FAILED)).toBe(true);
    expect(error.is(ErrorCode.STORAGE_WRITE_FAILED)).toBe(false);
  });

  // ---------- isCategory() ----------
  test('isCategory() matches prefix', () => {
    const error = new AppError({ code: ErrorCode.AUTH_INVALID_API_KEY });

    expect(error.isCategory('AUTH')).toBe(true);
    expect(error.isCategory('STORAGE')).toBe(false);
  });

  // ---------- toJSON() ----------
  test('toJSON() serializes correctly', () => {
    const error = new AppError({
      code: ErrorCode.UNKNOWN_ERROR,
      context: { detail: 'test' },
    });
    const json = error.toJSON();

    expect(json.name).toBe('AppError');
    expect(json.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(json.message).toBe(ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR]);
    expect(json.userMessage).toBe(ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR]);
    expect(json.context).toEqual({ detail: 'test' });
    expect(typeof json.timestamp).toBe('string');
  });
});

// =============================================================
// AuthError
// =============================================================
describe('Shared: AuthError', () => {
  test('invalidApiKey()', () => {
    const error = AuthError.invalidApiKey('AIzaSy12345');

    expect(error).toBeInstanceOf(AuthError);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('AuthError');
    expect(error.code).toBe(ErrorCode.AUTH_INVALID_API_KEY);
    expect(error.context).toEqual({ apiKeyPrefix: 'AIzaSy12' });
  });

  test('invalidApiKey() with no key', () => {
    const error = AuthError.invalidApiKey();

    expect(error.context).toEqual({ apiKeyPrefix: undefined });
  });

  test('notAuthenticated()', () => {
    const error = AuthError.notAuthenticated();

    expect(error).toBeInstanceOf(AuthError);
    expect(error.code).toBe(ErrorCode.AUTH_NOT_AUTHENTICATED);
  });
});

// =============================================================
// TranslationError
// =============================================================
describe('Shared: TranslationError', () => {
  test('failed()', () => {
    const error = TranslationError.failed();

    expect(error).toBeInstanceOf(TranslationError);
    expect(error.name).toBe('TranslationError');
    expect(error.code).toBe(ErrorCode.TRANSLATION_FAILED);
  });

  test('failed() with cause', () => {
    const cause = new Error('network');
    const error = TranslationError.failed(cause);

    expect(error.cause).toBe(cause);
  });

  test('rateLimited()', () => {
    const error = TranslationError.rateLimited(5000);

    expect(error.code).toBe(ErrorCode.TRANSLATION_RATE_LIMITED);
    expect(error.context).toEqual({ retryAfterMs: 5000 });
  });

  test('invalidImage()', () => {
    const error = TranslationError.invalidImage();
    expect(error.code).toBe(ErrorCode.TRANSLATION_INVALID_IMAGE);
  });

  test('unsupportedLanguage()', () => {
    const error = TranslationError.unsupportedLanguage('xx-FAKE');

    expect(error.code).toBe(ErrorCode.TRANSLATION_UNSUPPORTED_LANGUAGE);
    expect(error.context).toEqual({ language: 'xx-FAKE' });
  });

  test('malformedResponse()', () => {
    const error = TranslationError.malformedResponse();
    expect(error.code).toBe(ErrorCode.TRANSLATION_MALFORMED_RESPONSE);
  });

  test('aiRejected()', () => {
    const error = TranslationError.aiRejected('no text found');

    expect(error.code).toBe(ErrorCode.TRANSLATION_AI_REJECTED);
    expect(error.context).toEqual({ reason: 'no text found' });
  });
});

// =============================================================
// NetworkError
// =============================================================
describe('Shared: NetworkError', () => {
  test('offline()', () => {
    const error = NetworkError.offline();

    expect(error).toBeInstanceOf(NetworkError);
    expect(error.name).toBe('NetworkError');
    expect(error.code).toBe(ErrorCode.NETWORK_OFFLINE);
  });

  test('timeout()', () => {
    const error = NetworkError.timeout('https://api.example.com');

    expect(error.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    expect(error.context).toEqual({ url: 'https://api.example.com' });
  });

  test('serverError()', () => {
    const error = NetworkError.serverError(500, 'https://api.example.com');

    expect(error.code).toBe(ErrorCode.NETWORK_SERVER_ERROR);
    expect(error.context).toEqual({
      status: 500,
      url: 'https://api.example.com',
    });
  });

  // ---------- fromFetchError ----------
  describe('fromFetchError()', () => {
    const originalNavigator = globalThis.navigator;

    test('returns offline error when navigator.onLine is false', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        configurable: true,
      });

      const error = NetworkError.fromFetchError(
        new Error('Failed to fetch'),
        'https://api.example.com',
      );

      expect(error).toBeInstanceOf(NetworkError);
      expect(error.code).toBe(ErrorCode.NETWORK_OFFLINE);

      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
      });
    });

    test('returns timeout error for AbortError', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: true },
        configurable: true,
      });

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      const error = NetworkError.fromFetchError(
        abortError,
        'https://api.example.com/translate',
      );

      expect(error.code).toBe(ErrorCode.NETWORK_TIMEOUT);
      expect(error.context).toEqual({
        url: 'https://api.example.com/translate',
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
      });
    });

    test('wraps generic fetch error as server error', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: true },
        configurable: true,
      });

      const cause = new Error('network error');
      const error = NetworkError.fromFetchError(cause, 'https://api.test.com');

      expect(error.code).toBe(ErrorCode.NETWORK_SERVER_ERROR);
      expect(error.cause).toBe(cause);
      expect(error.context).toEqual({ url: 'https://api.test.com' });

      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
      });
    });
  });
});

// =============================================================
// StorageError
// =============================================================
describe('Shared: StorageError', () => {
  test('quotaExceeded()', () => {
    const error = StorageError.quotaExceeded();

    expect(error).toBeInstanceOf(StorageError);
    expect(error.name).toBe('StorageError');
    expect(error.code).toBe(ErrorCode.STORAGE_QUOTA_EXCEEDED);
  });

  test('readFailed()', () => {
    const error = StorageError.readFailed('credentials');

    expect(error.code).toBe(ErrorCode.STORAGE_READ_FAILED);
    expect(error.context).toEqual({ key: 'credentials' });
  });

  test('writeFailed()', () => {
    const cause = new Error('disk full');
    const error = StorageError.writeFailed('preferences', cause);

    expect(error.code).toBe(ErrorCode.STORAGE_WRITE_FAILED);
    expect(error.context).toEqual({ key: 'preferences' });
    expect(error.cause).toBe(cause);
  });
});

// =============================================================
// BrowserError
// =============================================================
describe('Shared: BrowserError', () => {
  test('noActiveTab()', () => {
    const error = BrowserError.noActiveTab();

    expect(error).toBeInstanceOf(BrowserError);
    expect(error.name).toBe('BrowserError');
    expect(error.code).toBe(ErrorCode.BROWSER_NO_ACTIVE_TAB);
  });

  test('scriptInjectionFailed()', () => {
    const cause = new Error('CSP blocked');
    const error = BrowserError.scriptInjectionFailed(cause, { tabId: 5 });

    expect(error.code).toBe(ErrorCode.BROWSER_SCRIPT_INJECTION_FAILED);
    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ tabId: 5 });
  });

  test('communicationFailed()', () => {
    const error = BrowserError.communicationFailed(undefined, { tabId: 10 });

    expect(error.code).toBe(ErrorCode.BROWSER_COMMUNICATION_FAILED);
    expect(error.context).toEqual({ tabId: 10 });
  });
});

// =============================================================
// Inheritance chain
// =============================================================
describe('Shared: Error hierarchy', () => {
  test('all subclasses are instanceof AppError', () => {
    const errors = [
      AuthError.notAuthenticated(),
      TranslationError.failed(),
      NetworkError.offline(),
      StorageError.quotaExceeded(),
      BrowserError.noActiveTab(),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    }
  });

  test('isCategory works across subclasses', () => {
    expect(AuthError.invalidApiKey().isCategory('AUTH')).toBe(true);
    expect(TranslationError.failed().isCategory('TRANSLATION')).toBe(true);
    expect(NetworkError.offline().isCategory('NETWORK')).toBe(true);
    expect(StorageError.readFailed('x').isCategory('STORAGE')).toBe(true);
  });
});
