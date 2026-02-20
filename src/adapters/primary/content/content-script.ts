/**
 * Content Script Entry Point
 *
 * This is a thin bootstrap file that wires up the theme manager
 * and message router. All UI mounting logic lives in dedicated
 * handlers and host utilities.
 */
import { ThemeManager } from './hosts/ThemeManager';
import { ContentMessageRouter } from './messaging/ContentMessageRouter';

const themeManager = new ThemeManager();
const messageRouter = new ContentMessageRouter(themeManager);
messageRouter.register();
