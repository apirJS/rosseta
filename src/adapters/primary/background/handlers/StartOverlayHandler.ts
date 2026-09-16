import type { OverlayService } from '../services/OverlayService';

export class StartOverlayHandler {
  constructor(private readonly overlayService: OverlayService) {}

  async handle(): Promise<void> {
    await this.overlayService.triggerOverlayOnActiveTab();
  }
}
