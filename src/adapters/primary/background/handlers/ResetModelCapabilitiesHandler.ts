import { isAnyProvider } from '../../../../core/domain/credential/Provider';
import { isCustomProviderId } from '../../../../core/domain/provider/CustomProviderConfig';
import type { Container } from '../../../../shared/di/container-factory';
import { AppError, ValidationError } from '../../../../shared/errors';
import { failure, success, type Result } from '../../../../shared/types/Result';
import type { RuntimeActionResult } from '../../../../shared/validation/MessageSchema';
import {
  modelScopeKey,
  PROVIDER_ENDPOINTS,
  providerProtocol,
} from '../../../secondary/shared/translation-capability-key';

interface ResetModelCapabilitiesPayload {
  provider: string;
  modelId: string;
}

export class ResetModelCapabilitiesHandler {
  constructor(private readonly container: Container) {}

  async handle(payload: ResetModelCapabilitiesPayload): Promise<RuntimeActionResult> {
    try {
      const identity = await this.resolveIdentity(payload);
      if (!identity.success) return this.runtimeFailure(identity.error);

      const result = await this.container.resetModelCapabilitiesUseCase.execute(identity.data);
      return result.success ? success(undefined) : this.runtimeFailure(result.error);
    } catch (error: unknown) {
      return this.runtimeFailure(AppError.fromUnknown(error));
    }
  }

  private async resolveIdentity(
    payload: ResetModelCapabilitiesPayload,
  ): Promise<Result<string, AppError>> {
    if (!isAnyProvider(payload.provider)) {
      return failure(ValidationError.invalidInput('Unknown provider.'));
    }

    let config;
    if (isCustomProviderId(payload.provider)) {
      const configs = await this.container.getCustomProvidersUseCase.execute();
      if (!configs.success) return configs;
      config = configs.data.find(item => item.id === payload.provider);
      if (!config) {
        return failure(ValidationError.invalidInput('Custom provider is not configured.'));
      }
    }

    return success(await modelScopeKey({
      providerId: payload.provider,
      modelId: payload.modelId,
      protocol: providerProtocol(payload.provider, config),
      baseURL: config?.baseURL ?? PROVIDER_ENDPOINTS[payload.provider],
      customConfig: config?.toProps(),
    }));
  }

  private runtimeFailure(error: AppError): RuntimeActionResult {
    return failure({ code: error.code, message: error.userMessage, userMessage: error.userMessage });
  }
}
