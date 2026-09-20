import { ValueObject } from '../shared/ValueObject';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';

export interface CustomProviderConfigProps {
  id: string;
  name: string;
  baseURL: string;
  type?: CustomProviderType;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
}

export type CustomProviderType = 'openai-compatible' | 'anthropic';

export const DEFAULT_CUSTOM_PROVIDER_TYPE: CustomProviderType =
  'openai-compatible';

export const CUSTOM_PROVIDER_ID_PREFIX = 'custom-';

export function isCustomProviderId(id: string): id is `custom-${string}` {
  return id.startsWith(CUSTOM_PROVIDER_ID_PREFIX);
}

const URL_PATTERN = /^https?:\/\/.+/;
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
}

function validateHeaders(
  headers: Record<string, string> | undefined,
): Result<void, DomainError> {
  if (!headers) return success(undefined);

  for (const [name, value] of Object.entries(headers)) {
    if (!HEADER_NAME_PATTERN.test(name)) {
      return failure(new DomainError(`Invalid header name: "${name}"`));
    }
    if (containsControlCharacter(value)) {
      return failure(
        new DomainError(`Header "${name}" contains control characters`),
      );
    }
  }

  return success(undefined);
}

function validateQueryParams(
  queryParams: Record<string, string> | undefined,
): Result<void, DomainError> {
  if (!queryParams) return success(undefined);

  for (const [name, value] of Object.entries(queryParams)) {
    if (!name.trim()) {
      return failure(new DomainError('Query parameter names cannot be empty'));
    }
    if (
      containsControlCharacter(name) ||
      containsControlCharacter(value)
    ) {
      return failure(
        new DomainError(
          `Query parameter "${name}" contains control characters`,
        ),
      );
    }
  }

  return success(undefined);
}

export class CustomProviderConfig extends ValueObject {
  private constructor(private readonly props: CustomProviderConfigProps) {
    super();
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get baseURL(): string {
    return this.props.baseURL;
  }

  get type(): CustomProviderType {
    return this.props.type ?? DEFAULT_CUSTOM_PROVIDER_TYPE;
  }

  get headers(): Record<string, string> | undefined {
    return this.props.headers;
  }

  get queryParams(): Record<string, string> | undefined {
    return this.props.queryParams;
  }

  toProps(): CustomProviderConfigProps {
    return {
      ...this.props,
      type: this.type,
      headers: this.props.headers ? { ...this.props.headers } : undefined,
      queryParams: this.props.queryParams
        ? { ...this.props.queryParams }
        : undefined,
    };
  }

  static create(
    props: CustomProviderConfigProps,
  ): Result<CustomProviderConfig, DomainError> {
    if (!isCustomProviderId(props.id)) {
      return failure(
        new DomainError(
          `Provider id must start with "${CUSTOM_PROVIDER_ID_PREFIX}"`,
        ),
      );
    }

    const name = props.name.trim();
    if (!name) {
      return failure(new DomainError('Provider name is required'));
    }

    const baseURL = props.baseURL.trim();
    if (!URL_PATTERN.test(baseURL)) {
      return failure(
        new DomainError('Base URL must start with http:// or https://'),
      );
    }

    if (
      props.type !== undefined &&
      props.type !== 'openai-compatible' &&
      props.type !== 'anthropic'
    ) {
      return failure(new DomainError('Unsupported custom provider type'));
    }

    const headersResult = validateHeaders(props.headers);
    if (!headersResult.success) return failure(headersResult.error);

    const queryParamsResult = validateQueryParams(props.queryParams);
    if (!queryParamsResult.success) return failure(queryParamsResult.error);

    return success(
      new CustomProviderConfig({
        ...props,
        name,
        baseURL,
        type: props.type ?? DEFAULT_CUSTOM_PROVIDER_TYPE,
        headers:
          props.headers && Object.keys(props.headers).length > 0
            ? { ...props.headers }
            : undefined,
        queryParams:
          props.queryParams && Object.keys(props.queryParams).length > 0
            ? { ...props.queryParams }
            : undefined,
      }),
    );
  }
}
