import * as browser from 'webextension-polyfill';
import { COMMAND } from '../../../shared/validation/MessageSchema';
import type { OverlayService } from './services/OverlayService';

/**
 * Listens for browser keyboard commands and dispatches them.
 * Handles the START_EXTENSION command.
 */
export class CommandListener {
  constructor(private readonly overlayService: OverlayService) {}

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
