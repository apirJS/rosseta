import { describe, expect, test } from 'bun:test';
import {
  CustomProviderConfig,
  isCustomProviderId,
  type CustomProviderConfigProps,
} from './CustomProviderConfig';

function baseProps(
  overrides: Partial<CustomProviderConfigProps> = {},
): CustomProviderConfigProps {
  return {
    id: 'custom-test-1',
    name: 'My Provider',
    baseURL: 'https://api.example.com/v1',
    ...overrides,
  };
}

describe('Domain: CustomProviderConfig', () => {
  test.each(['custom-', 'custom- ', 'custom-\t'])(
    'rejects an empty custom identifier %s',
    (id) => {
      expect(CustomProviderConfig.create(baseProps({ id })).success).toBe(
        false,
      );
    },
  );

  test.each([
    'https://%',
    'http://[invalid',
    'https://example.com:99999',
    'https://exa\nmple.com',
  ])('rejects an unusable endpoint %s', (baseURL) => {
    expect(CustomProviderConfig.create(baseProps({ baseURL })).success).toBe(
      false,
    );
  });

  test.each([
    'https://user:password@example.com/v1',
    'http://user@example.com',
  ])('rejects URL credentials that browser fetch cannot send', (baseURL) => {
    expect(CustomProviderConfig.create(baseProps({ baseURL })).success).toBe(
      false,
    );
  });

  test.each([
    'http://localhost:8080/v1',
    'https://api.example.com/v1?mode=vision',
    'http://[::1]:3000/v1',
  ])('keeps valid local and remote endpoints %s', (baseURL) => {
    expect(CustomProviderConfig.create(baseProps({ baseURL })).success).toBe(
      true,
    );
  });

  test.each(['日本語', 'Bearer 😀'])(
    'rejects header values that cannot be represented as HTTP header bytes',
    (value) => {
      expect(
        CustomProviderConfig.create(
          baseProps({ headers: { 'X-Token': value } }),
        ).success,
      ).toBe(false);
    },
  );

  test('keeps valid Latin-1 header values', () => {
    expect(
      CustomProviderConfig.create(baseProps({ headers: { 'X-Label': 'café' } }))
        .success,
    ).toBe(true);
  });

  test('creates a valid config', () => {
    const result = CustomProviderConfig.create(baseProps());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.id).toBe('custom-test-1');
      expect(result.data.name).toBe('My Provider');
      expect(result.data.baseURL).toBe('https://api.example.com/v1');
    }
  });

  test('rejects id without custom- prefix', () => {
    const result = CustomProviderConfig.create(baseProps({ id: 'openai' }));

    expect(result.success).toBe(false);
  });

  test('isCustomProviderId matches the prefix', () => {
    expect(isCustomProviderId('custom-openrouter')).toBe(true);
    expect(isCustomProviderId('google')).toBe(false);
  });

  test('trims name and baseURL', () => {
    const result = CustomProviderConfig.create(
      baseProps({ name: '  Padded  ', baseURL: '  https://api.example.com  ' }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.name).toBe('Padded');
      expect(result.data.baseURL).toBe('https://api.example.com');
    }
  });

  test('rejects empty name', () => {
    const result = CustomProviderConfig.create(baseProps({ name: '   ' }));

    expect(result.success).toBe(false);
  });

  test('rejects non-http base URL', () => {
    const result = CustomProviderConfig.create(
      baseProps({ baseURL: 'ftp://example.com' }),
    );

    expect(result.success).toBe(false);
  });

  test('rejects base URL without protocol', () => {
    const result = CustomProviderConfig.create(
      baseProps({ baseURL: 'api.example.com/v1' }),
    );

    expect(result.success).toBe(false);
  });

  test('drops empty headers and queryParams', () => {
    const result = CustomProviderConfig.create(
      baseProps({ headers: {}, queryParams: {} }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.headers).toBeUndefined();
      expect(result.data.queryParams).toBeUndefined();
    }
  });

  test('toProps returns a defensive copy', () => {
    const headers = { 'X-Test': 'value' };
    const result = CustomProviderConfig.create(baseProps({ headers }));

    expect(result.success).toBe(true);

    if (result.success) {
      const props = result.data.toProps();

      expect(props.headers).toEqual(headers);
      expect(props.headers).not.toBe(headers);
    }
  });
});
