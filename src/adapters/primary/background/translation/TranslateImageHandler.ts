import type { TranslationRequestIdentity } from '../../../../shared/messaging/MessageSchema';
import {
  TranslationJobCoordinator,
  type TranslateImagePayload,
} from './TranslationJobCoordinator';
import type { TranslationOrigin } from './TranslationRequestRegistry';

export class TranslateImageHandler {
  constructor(private readonly coordinator: TranslationJobCoordinator) {}

  handle(payload: TranslateImagePayload, origin: TranslationOrigin) {
    return this.coordinator.handle(payload, origin);
  }

  cancel(
    identity: TranslationRequestIdentity,
    origin: TranslationOrigin,
  ): void {
    this.coordinator.cancel(identity, origin);
  }

  status(identity: TranslationRequestIdentity, origin: TranslationOrigin) {
    return this.coordinator.status(identity, origin);
  }
}
