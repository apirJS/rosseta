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

const messageRouter = new MessageRouter(container);
messageRouter.register();

const commandListener = new CommandListener(container);
commandListener.register();
