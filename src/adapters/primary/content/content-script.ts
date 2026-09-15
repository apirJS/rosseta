import { ThemeManager } from './hosts/ThemeManager';
import { ContentMessageRouter } from './messaging/ContentMessageRouter';

const themeManager = new ThemeManager();
const messageRouter = new ContentMessageRouter(themeManager);
messageRouter.register();
