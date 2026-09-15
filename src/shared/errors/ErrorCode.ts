export enum ErrorCode {
  AUTH_INVALID_API_KEY = 'AUTH_INVALID_API_KEY',
  AUTH_NOT_AUTHENTICATED = 'AUTH_NOT_AUTHENTICATED',

  TRANSLATION_FAILED = 'TRANSLATION_FAILED',
  TRANSLATION_RATE_LIMITED = 'TRANSLATION_RATE_LIMITED',
  TRANSLATION_INVALID_IMAGE = 'TRANSLATION_INVALID_IMAGE',
  TRANSLATION_UNSUPPORTED_LANGUAGE = 'TRANSLATION_UNSUPPORTED_LANGUAGE',
  TRANSLATION_MALFORMED_RESPONSE = 'TRANSLATION_MALFORMED_RESPONSE',
  TRANSLATION_AI_REJECTED = 'TRANSLATION_AI_REJECTED',
  TRANSLATION_MODEL_NO_VISION = 'TRANSLATION_MODEL_NO_VISION',

  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_SERVER_ERROR = 'NETWORK_SERVER_ERROR',

  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_READ_FAILED = 'STORAGE_READ_FAILED',
  STORAGE_WRITE_FAILED = 'STORAGE_WRITE_FAILED',

  VALIDATION_INVALID_INPUT = 'VALIDATION_INVALID_INPUT',
  VALIDATION_EMPTY_SELECTION = 'VALIDATION_EMPTY_SELECTION',

  BROWSER_NO_ACTIVE_TAB = 'BROWSER_NO_ACTIVE_TAB',
  BROWSER_SCRIPT_INJECTION_FAILED = 'BROWSER_SCRIPT_INJECTION_FAILED',
  BROWSER_COMMUNICATION_FAILED = 'BROWSER_COMMUNICATION_FAILED',

  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.BROWSER_NO_ACTIVE_TAB]: 'Unable to find an active browser tab.',
  [ErrorCode.BROWSER_SCRIPT_INJECTION_FAILED]:
    'Failed to inject necessary scripts into the page.',
  [ErrorCode.BROWSER_COMMUNICATION_FAILED]:
    'Failed to communicate with the page.',

  [ErrorCode.AUTH_INVALID_API_KEY]:
    'Invalid API key. Please check your key and try again.',
  [ErrorCode.AUTH_NOT_AUTHENTICATED]: 'No API key set. Add one in the popup.',

  [ErrorCode.TRANSLATION_FAILED]: 'Translation failed. Please try again.',
  [ErrorCode.TRANSLATION_RATE_LIMITED]:
    'Too many requests. Please wait a moment.',
  [ErrorCode.TRANSLATION_INVALID_IMAGE]: 'Could not process the image.',
  [ErrorCode.TRANSLATION_UNSUPPORTED_LANGUAGE]:
    'This language is not supported.',
  [ErrorCode.TRANSLATION_MALFORMED_RESPONSE]:
    'Received an unexpected response from the translation service.',
  [ErrorCode.TRANSLATION_AI_REJECTED]: 'The AI could not process this image.',
  [ErrorCode.TRANSLATION_MODEL_NO_VISION]:
    'The selected model cannot read images. Pick a vision-capable model.',

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
