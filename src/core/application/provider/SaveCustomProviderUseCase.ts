import { v4 as uuidv4 } from 'uuid';
import type { ISaveCustomProviderUseCase } from '../../ports/inbound/provider/ISaveCustomProviderUseCase';
import type { ICustomProviderStorage } from '../../ports/outbound/ICustomProviderStorage';
import {
  CustomProviderConfig,
  CUSTOM_PROVIDER_ID_PREFIX,
  type CustomProviderConfigProps,
} from '../../domain/provider/CustomProviderConfig';
import { ValidationError } from '../../../shared/errors';
import {
  success,
  failure,
  type Result,
} from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class SaveCustomProviderUseCase implements ISaveCustomProviderUseCase {
  constructor(private readonly storage: ICustomProviderStorage) {}

  async execute(
    props: CustomProviderConfigProps,
  ): Promise<Result<CustomProviderConfig, AppError>> {
    const id = props.id.trim() || `${CUSTOM_PROVIDER_ID_PREFIX}${uuidv4()}`;

    const configResult = CustomProviderConfig.create({ ...props, id });
    if (!configResult.success) {
      return failure(
        ValidationError.invalidInput(configResult.error.message),
      );
    }

    const saveResult = await this.storage.save(configResult.data);
    if (!saveResult.success) {
      return saveResult;
    }

    return success(configResult.data);
  }
}
