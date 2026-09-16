import * as browser from 'webextension-polyfill';
import { COMMAND } from '../../../shared/validation/MessageSchema';
import type { OverlayService } from './services/OverlayService';

export class CommandListener {
  constructor(private readonly overlayService: OverlayService) {}

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
