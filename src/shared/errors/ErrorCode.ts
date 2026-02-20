/**
 * Centralized error codes for the entire application.
 * Format: CATEGORY_SPECIFIC_ERROR
 */
export enum ErrorCode {
  // Auth errors (1xxx)
  AUTH_INVALID_API_KEY = 'AUTH_INVALID_API_KEY',
  AUTH_NOT_AUTHENTICATED = 'AUTH_NOT_AUTHENTICATED',

  // Translation errors (2xxx)
  TRANSLATION_FAILED = 'TRANSLATION_FAILED',
  TRANSLATION_RATE_LIMITED = 'TRANSLATION_RATE_LIMITED',
  TRANSLATION_INVALID_IMAGE = 'TRANSLATION_INVALID_IMAGE',
  TRANSLATION_UNSUPPORTED_LANGUAGE = 'TRANSLATION_UNSUPPORTED_LANGUAGE',
  TRANSLATION_MALFORMED_RESPONSE = 'TRANSLATION_MALFORMED_RESPONSE',
  TRANSLATION_AI_REJECTED = 'TRANSLATION_AI_REJECTED',

  // Network errors (3xxx)
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_SERVER_ERROR = 'NETWORK_SERVER_ERROR',

  // Storage errors (4xxx)
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_READ_FAILED = 'STORAGE_READ_FAILED',
  STORAGE_WRITE_FAILED = 'STORAGE_WRITE_FAILED',

  // Validation errors (5xxx)
  VALIDATION_INVALID_INPUT = 'VALIDATION_INVALID_INPUT',
  VALIDATION_EMPTY_SELECTION = 'VALIDATION_INVALID_SELECTION',

  // Browser/Extension errors (6xxx)
  BROWSER_NO_ACTIVE_TAB = 'BROWSER_NO_ACTIVE_TAB',
  BROWSER_SCRIPT_INJECTION_FAILED = 'BROWSER_SCRIPT_INJECTION_FAILED',
  BROWSER_COMMUNICATION_FAILED = 'BROWSER_COMMUNICATION_FAILED',

  // Unknown
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Maps error codes to user-friendly messages.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.BROWSER_NO_ACTIVE_TAB]: 'Unable to find an active browser tab.',
  [ErrorCode.BROWSER_SCRIPT_INJECTION_FAILED]:
    'Failed to inject necessary scripts into the page.',
  [ErrorCode.BROWSER_COMMUNICATION_FAILED]:
    'Failed to communicate with the page.',

  [ErrorCode.AUTH_INVALID_API_KEY]:
    'Invalid API key. Please check your key and try again.',
  [ErrorCode.AUTH_NOT_AUTHENTICATED]: 'Please log in to use this feature.',

  [ErrorCode.TRANSLATION_FAILED]: 'Translation failed. Please try again.',
  [ErrorCode.TRANSLATION_RATE_LIMITED]:
    'Too many requests. Please wait a moment.',
  [ErrorCode.TRANSLATION_INVALID_IMAGE]: 'Could not process the image.',
  [ErrorCode.TRANSLATION_UNSUPPORTED_LANGUAGE]:
    'This language is not supported.',
  [ErrorCode.TRANSLATION_MALFORMED_RESPONSE]:
    'Received an unexpected response from the translation service.',
  [ErrorCode.TRANSLATION_AI_REJECTED]: 'The AI could not process this image.',

  [ErrorCode.NETWORK_OFFLINE]: 'No internet connection.',
  [ErrorCode.NETWORK_TIMEOUT]: 'Request timed out. Please try again.',
  [ErrorCode.NETWORK_SERVER_ERROR]: 'Server error. Please try again later.',

  [ErrorCode.STORAGE_QUOTA_EXCEEDED]:
    'Storage is full. Please clear some history.',
  [ErrorCode.STORAGE_READ_FAILED]: 'Could not load data.',
  [ErrorCode.STORAGE_WRITE_FAILED]: 'Could not save data.',

  [ErrorCode.VALIDATION_INVALID_INPUT]: 'Invalid input provided.',
  [ErrorCode.VALIDATION_EMPTY_SELECTION]: 'Please select an area to translate.',

  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred.',
};
