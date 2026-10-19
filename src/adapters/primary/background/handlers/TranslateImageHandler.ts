import type { Container } from '../../../../shared/di/container-factory';
import type { TranslationRequestIdentity } from '../../../../shared/validation/MessageSchema';
import { TranslationJobCoordinator, type TranslateImagePayload } from '../services/TranslationJobCoordinator';
import type { TranslationOrigin } from '../services/TranslationRequestRegistry';

export class TranslateImageHandler {
  private readonly coordinator: TranslationJobCoordinator;

  constructor(container: Container, coordinator?: TranslationJobCoordinator) {
    this.coordinator = coordinator ?? new TranslationJobCoordinator(container);
  }

  handle(payload: TranslateImagePayload, origin: TranslationOrigin) {
    return this.coordinator.handle(payload, origin);
  }

  cancel(identity: TranslationRequestIdentity, origin: TranslationOrigin): void {
    this.coordinator.cancel(identity, origin);
  }

  status(identity: TranslationRequestIdentity, origin: TranslationOrigin) {
    return this.coordinator.status(identity, origin);
  }
}
