import * as browser from 'webextension-polyfill';
import { COMMAND } from '../../../shared/validation/MessageSchema';
import { OverlayService } from './services/OverlayService';
import type { Container } from '../../../shared/di/container-factory';

/**
 * Listens for browser keyboard commands and dispatches them.
 * Handles the START_EXTENSION command.
 */
export class CommandListener {
  private readonly overlayService: OverlayService;

  constructor(container: Container) {
    this.overlayService = new OverlayService(container);
  }

  /**
   * Registers the onCommand listener with the browser commands API.
   */
  register(): void {
    browser.commands.onCommand.addListener(async (command) => {
      switch (command) {
        case COMMAND.START_EXTENSION:
          await this.overlayService.triggerOverlayOnActiveTab();
          break;

        default:
          break;
      }
    });
  }
}
