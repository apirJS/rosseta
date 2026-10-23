import type { OverlayService } from './OverlayService';

export class StartOverlayHandler {
  constructor(private readonly overlayService: OverlayService) {}

  async handle(): Promise<void> {
    await this.overlayService.triggerOverlayOnActiveTab();
  }
}
