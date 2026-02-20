import type { OverlayService } from '../services/OverlayService';

/**
 * Handles the START_OVERLAY message action.
 * Delegates to OverlayService for the actual orchestration.
 */
export class StartOverlayHandler {
  constructor(private readonly overlayService: OverlayService) {}

  async handle(): Promise<void> {
    await this.overlayService.triggerOverlayOnActiveTab();
  }
}
