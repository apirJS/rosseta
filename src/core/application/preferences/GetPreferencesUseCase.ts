import type { IGetPreferencesUseCase } from '../../ports/inbound/preferences/IGetPreferencesUseCase';
import type { IUserPreferencesStorage } from '../../ports/outbound/IUserPreferencesStorage';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';
import type { UserPreferences } from '../../domain/preferences/UserPreferences';

export class GetPreferencesUseCase implements IGetPreferencesUseCase {
  constructor(private readonly preferencesStorage: IUserPreferencesStorage) {}

  async execute(): Promise<Result<UserPreferences | null, AppError>> {
    return this.preferencesStorage.get();
  }
}
