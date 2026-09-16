import { container } from './di-container';
import { MessageRouter } from './MessageRouter';
import { CommandListener } from './CommandListener';
import { OverlayService } from './services/OverlayService';

const overlayService = new OverlayService(container);

const messageRouter = new MessageRouter(container, overlayService);
messageRouter.register();

const commandListener = new CommandListener(overlayService);
commandListener.register();
