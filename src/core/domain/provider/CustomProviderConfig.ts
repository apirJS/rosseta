import { ValueObject } from '../shared/ValueObject';
import { DomainError } from '../shared/DomainError';
import { failure, success, type Result } from '../../../shared/types/Result';

export interface CustomProviderConfigProps {
  id: string;
  name: string;
  baseURL: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
}

export const CUSTOM_PROVIDER_ID_PREFIX = 'custom-';

export function isCustomProviderId(id: string): id is `custom-${string}` {
  return id.startsWith(CUSTOM_PROVIDER_ID_PREFIX);
}

const URL_PATTERN = /^https?:\/\/.+/;

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

  get headers(): Record<string, string> | undefined {
    return this.props.headers;
  }

  get queryParams(): Record<string, string> | undefined {
    return this.props.queryParams;
  }

  toProps(): CustomProviderConfigProps {
    return {
      ...this.props,
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

    return success(
      new CustomProviderConfig({
        ...props,
        name,
        baseURL,
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
