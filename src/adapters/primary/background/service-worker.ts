/**
 * Service Worker Entry Point
 *
 * This is a thin bootstrap file that wires up the message router
 * and command listener. All business logic lives in dedicated
 * handlers and services.
 */
import { container } from './di-container';
import { MessageRouter } from './MessageRouter';
import { CommandListener } from './CommandListener';
import { OverlayService } from './services/OverlayService';

const overlayService = new OverlayService(container);

const messageRouter = new MessageRouter(container, overlayService);
messageRouter.register();

const commandListener = new CommandListener(overlayService);
commandListener.register();
