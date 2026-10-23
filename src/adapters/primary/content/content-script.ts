import { ThemeManager } from './hosts/ThemeManager';
import { ContentMessageRouter } from './messaging/ContentMessageRouter';
import { TranslationModalHandler } from './translation/TranslationModalHandler';
import { ToastHandler } from './messaging/ToastHandler';
import { OverlayHandler } from './capture/OverlayHandler';

const themeManager = new ThemeManager();

const messageRouter = new ContentMessageRouter(themeManager, {
  translation: new TranslationModalHandler(themeManager),
  toast: new ToastHandler(themeManager),
  createOverlay: (start) => new OverlayHandler(start),
});

messageRouter.register();
