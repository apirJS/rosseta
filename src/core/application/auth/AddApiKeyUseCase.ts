import type {
  IAddApiKeyUseCase,
  AddApiKeyCommand,
} from '../../ports/inbound/auth/IAddApiKeyUseCase';
import type { ICredentialStorage } from '../../ports/outbound/ICredentialStorage';
import type { IApiKeyValidator } from '../../ports/outbound/IApiKeyValidator';
import { success, failure, type Result } from '../../../shared/types/Result';
import { AuthError, type AppError } from '../../../shared/errors';
import { Credential } from '../../domain/credential/Credential';
import { Credentials } from '../../domain/credential/Credentials';
import { v4 as uuidv4 } from 'uuid';

export class AddApiKeyUseCase implements IAddApiKeyUseCase {
  constructor(
    private readonly credentialStorage: ICredentialStorage,
    private readonly apiKeyValidator: IApiKeyValidator,
  ) {}

  async execute(
    command: AddApiKeyCommand,
  ): Promise<Result<Credentials, AppError>> {
    const provider = command.apiKey.provider;

    const validationResult = await this.apiKeyValidator.validate(
      command.apiKey.value,
      provider,
    );
    if (!validationResult.success) {
      return failure(validationResult.error);
    }

    const credentialResult = Credential.create(
      uuidv4(),
      command.apiKey,
      provider,
    );
    if (!credentialResult.success) {
      return failure(AuthError.invalidApiKey(credentialResult.error.message));
    }

    const storageResult = await this.credentialStorage.get();
    if (!storageResult.success) {
      return failure(storageResult.error);
    }

    const credentials = storageResult.data ?? Credentials.createEmpty(uuidv4());
    const updated = credentials.add(credentialResult.data);

    const saveResult = await this.credentialStorage.save(updated);
    if (!saveResult.success) {
      return failure(saveResult.error);
    }

    return success(updated);
  }
}
