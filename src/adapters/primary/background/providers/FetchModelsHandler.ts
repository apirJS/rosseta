import type { IRefreshProviderModelsUseCase } from '../../../../core/ports/inbound/providers/IRefreshProviderModelsUseCase';
import type { FetchModelsResponse } from '../../../../shared/messaging/MessageSchema';

/** Browser DTO serialization; the application action owns refresh and reset. */
export class FetchModelsHandler {
  constructor(private readonly refreshModels: IRefreshProviderModelsUseCase) {}

  async handle(payload: { provider: string }): Promise<FetchModelsResponse> {
    const result = await this.refreshModels.execute(payload.provider);

    if (result.success) return { success: true, models: result.data };

    const { code, message, userMessage } = result.error;

    return { success: false, error: { code, message, userMessage } };
  }
}
