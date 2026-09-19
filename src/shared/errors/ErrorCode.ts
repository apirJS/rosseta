export enum ErrorCode {
  AUTH_INVALID_API_KEY = 'AUTH_INVALID_API_KEY',
  AUTH_NOT_AUTHENTICATED = 'AUTH_NOT_AUTHENTICATED',
  AUTH_ACCESS_DENIED = 'AUTH_ACCESS_DENIED',
  AUTH_PAYMENT_REQUIRED = 'AUTH_PAYMENT_REQUIRED',

  TRANSLATION_FAILED = 'TRANSLATION_FAILED',
  TRANSLATION_RATE_LIMITED = 'TRANSLATION_RATE_LIMITED',
  TRANSLATION_INVALID_IMAGE = 'TRANSLATION_INVALID_IMAGE',
  TRANSLATION_UNSUPPORTED_LANGUAGE = 'TRANSLATION_UNSUPPORTED_LANGUAGE',
  TRANSLATION_MALFORMED_RESPONSE = 'TRANSLATION_MALFORMED_RESPONSE',
  TRANSLATION_AI_REJECTED = 'TRANSLATION_AI_REJECTED',
  TRANSLATION_MODEL_NO_VISION = 'TRANSLATION_MODEL_NO_VISION',
  TRANSLATION_NO_TEXT_FOUND = 'TRANSLATION_NO_TEXT_FOUND',
  TRANSLATION_MODEL_NOT_FOUND = 'TRANSLATION_MODEL_NOT_FOUND',
  TRANSLATION_CONTENT_BLOCKED = 'TRANSLATION_CONTENT_BLOCKED',
  TRANSLATION_CONTEXT_LIMIT = 'TRANSLATION_CONTEXT_LIMIT',
  TRANSLATION_IMAGE_TOO_LARGE = 'TRANSLATION_IMAGE_TOO_LARGE',
  TRANSLATION_REQUEST_REJECTED = 'TRANSLATION_REQUEST_REJECTED',
  TRANSLATION_EMPTY_RESPONSE = 'TRANSLATION_EMPTY_RESPONSE',
  TRANSLATION_PROVIDER_QUOTA_EXCEEDED =
    'TRANSLATION_PROVIDER_QUOTA_EXCEEDED',

  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_SERVER_ERROR = 'NETWORK_SERVER_ERROR',
  NETWORK_CONNECTION_FAILED = 'NETWORK_CONNECTION_FAILED',
  NETWORK_PROVIDER_UNAVAILABLE = 'NETWORK_PROVIDER_UNAVAILABLE',
  NETWORK_RATE_LIMITED = 'NETWORK_RATE_LIMITED',
  NETWORK_INVALID_RESPONSE = 'NETWORK_INVALID_RESPONSE',

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
  [ErrorCode.AUTH_ACCESS_DENIED]:
    'The provider denied access. Check the key permissions and model access.',
  [ErrorCode.AUTH_PAYMENT_REQUIRED]:
    'The provider requires billing or credits for this request.',

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
  [ErrorCode.TRANSLATION_NO_TEXT_FOUND]:
    'No readable text was found in the selected area.',
  [ErrorCode.TRANSLATION_MODEL_NOT_FOUND]:
    'The selected model was not found. Refresh the model list or choose another model.',
  [ErrorCode.TRANSLATION_CONTENT_BLOCKED]:
    'The provider blocked this image because of its content or safety policy.',
  [ErrorCode.TRANSLATION_CONTEXT_LIMIT]:
    'The request is too large for this model. Select a smaller area or choose a model with a larger context window.',
  [ErrorCode.TRANSLATION_IMAGE_TOO_LARGE]:
    'The image is too large for this provider. Select a smaller area and try again.',
  [ErrorCode.TRANSLATION_REQUEST_REJECTED]:
    'The provider rejected this request. Check the selected model and provider configuration.',
  [ErrorCode.TRANSLATION_EMPTY_RESPONSE]:
    'The model returned no usable output. Try again or choose another model.',
  [ErrorCode.TRANSLATION_PROVIDER_QUOTA_EXCEEDED]:
    'The provider account has no remaining quota or credits.',

  [ErrorCode.NETWORK_OFFLINE]: 'No internet connection.',
  [ErrorCode.NETWORK_TIMEOUT]: 'Request timed out. Please try again.',
  [ErrorCode.NETWORK_SERVER_ERROR]: 'Server error. Please try again later.',
  [ErrorCode.NETWORK_CONNECTION_FAILED]:
    'Could not connect to the provider. Check your connection and provider URL.',
  [ErrorCode.NETWORK_PROVIDER_UNAVAILABLE]:
    'The provider is temporarily unavailable. Try again later.',
  [ErrorCode.NETWORK_RATE_LIMITED]:
    'The provider is receiving too many requests. Wait a moment and try again.',
  [ErrorCode.NETWORK_INVALID_RESPONSE]:
    'The provider returned an invalid response. Check the provider URL or try again.',

  [ErrorCode.STORAGE_QUOTA_EXCEEDED]:
    'Storage is full. Please clear some history.',
  [ErrorCode.STORAGE_READ_FAILED]: 'Could not load data.',
  [ErrorCode.STORAGE_WRITE_FAILED]: 'Could not save data.',

  [ErrorCode.VALIDATION_INVALID_INPUT]: 'Invalid input provided.',
  [ErrorCode.VALIDATION_EMPTY_SELECTION]: 'Please select an area to translate.',

  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred.',
};

export const ERROR_TITLES: Record<ErrorCode, string> = {
  [ErrorCode.AUTH_INVALID_API_KEY]: 'Invalid API Key',
  [ErrorCode.AUTH_NOT_AUTHENTICATED]: 'No API Key',
  [ErrorCode.AUTH_ACCESS_DENIED]: 'Access Denied',
  [ErrorCode.AUTH_PAYMENT_REQUIRED]: 'Billing Required',
  [ErrorCode.TRANSLATION_FAILED]: 'Translation Failed',
  [ErrorCode.TRANSLATION_RATE_LIMITED]: 'Rate Limit Reached',
  [ErrorCode.TRANSLATION_INVALID_IMAGE]: 'Invalid Image',
  [ErrorCode.TRANSLATION_UNSUPPORTED_LANGUAGE]: 'Unsupported Language',
  [ErrorCode.TRANSLATION_MALFORMED_RESPONSE]: 'Invalid Model Response',
  [ErrorCode.TRANSLATION_AI_REJECTED]: 'Image Rejected',
  [ErrorCode.TRANSLATION_MODEL_NO_VISION]: 'Model Cannot Read Images',
  [ErrorCode.TRANSLATION_NO_TEXT_FOUND]: 'No Text Found',
  [ErrorCode.TRANSLATION_MODEL_NOT_FOUND]: 'Model Not Found',
  [ErrorCode.TRANSLATION_CONTENT_BLOCKED]: 'Content Blocked',
  [ErrorCode.TRANSLATION_CONTEXT_LIMIT]: 'Request Too Large',
  [ErrorCode.TRANSLATION_IMAGE_TOO_LARGE]: 'Image Too Large',
  [ErrorCode.TRANSLATION_REQUEST_REJECTED]: 'Request Rejected',
  [ErrorCode.TRANSLATION_EMPTY_RESPONSE]: 'Empty Model Response',
  [ErrorCode.TRANSLATION_PROVIDER_QUOTA_EXCEEDED]: 'Quota Exhausted',
  [ErrorCode.NETWORK_OFFLINE]: 'You Are Offline',
  [ErrorCode.NETWORK_TIMEOUT]: 'Request Timed Out',
  [ErrorCode.NETWORK_SERVER_ERROR]: 'Provider Error',
  [ErrorCode.NETWORK_CONNECTION_FAILED]: 'Connection Failed',
  [ErrorCode.NETWORK_PROVIDER_UNAVAILABLE]: 'Provider Unavailable',
  [ErrorCode.NETWORK_RATE_LIMITED]: 'Rate Limit Reached',
  [ErrorCode.NETWORK_INVALID_RESPONSE]: 'Invalid Provider Response',
  [ErrorCode.STORAGE_QUOTA_EXCEEDED]: 'Storage Full',
  [ErrorCode.STORAGE_READ_FAILED]: 'Could Not Load Data',
  [ErrorCode.STORAGE_WRITE_FAILED]: 'Could Not Save Data',
  [ErrorCode.VALIDATION_INVALID_INPUT]: 'Invalid Configuration',
  [ErrorCode.VALIDATION_EMPTY_SELECTION]: 'Nothing Selected',
  [ErrorCode.BROWSER_NO_ACTIVE_TAB]: 'No Active Tab',
  [ErrorCode.BROWSER_SCRIPT_INJECTION_FAILED]: 'Page Not Supported',
  [ErrorCode.BROWSER_COMMUNICATION_FAILED]: 'Page Communication Failed',
  [ErrorCode.UNKNOWN_ERROR]: 'Unexpected Error',
};
