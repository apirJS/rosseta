import type { IGetShortcutUseCase } from '../../ports/inbound/command/IGetShortcutUseCase';
import type { ICommandStorage } from '../../ports/outbound/ICommandStorage';
import type { Result } from '../../../shared/types/Result';
import type { AppError } from '../../../shared/errors';

export class GetShortcutUseCase implements IGetShortcutUseCase {
  constructor(private readonly commandStorage: ICommandStorage) {}

  async execute(commandName: string): Promise<Result<string | null, AppError>> {
    return this.commandStorage.getShortcut(commandName);
  }
}
