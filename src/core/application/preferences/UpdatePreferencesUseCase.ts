import type {
  IUpdatePreferencesUseCase,
  UpdatePreferencesCommand,
} from '../../ports/inbound/preferences/IUpdatePreferencesUseCase';
import type { IUserPreferencesStorage } from '../../ports/outbound/IUserPreferencesStorage';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class UpdatePreferencesUseCase implements IUpdatePreferencesUseCase {
  constructor(private readonly preferencesStorage: IUserPreferencesStorage) {}

  async execute(
    command: UpdatePreferencesCommand,
  ): Promise<Result<void, AppError>> {
    return this.preferencesStorage.set(command.preferences);
  }
}
