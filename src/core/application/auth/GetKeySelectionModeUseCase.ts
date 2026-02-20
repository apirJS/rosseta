import type { IGetKeySelectionModeUseCase } from '../../ports/inbound/auth/IGetKeySelectionModeUseCase';
import type { IKeySelectionStorage } from '../../ports/outbound/IKeySelectionStorage';
import type { KeySelectionMode } from '../../domain/credential/KeySelectionMode';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class GetKeySelectionModeUseCase implements IGetKeySelectionModeUseCase {
  constructor(private readonly keySelectionStorage: IKeySelectionStorage) {}

  async execute(): Promise<Result<KeySelectionMode, AppError>> {
    return this.keySelectionStorage.getMode();
  }
}
