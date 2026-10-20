import { createBackgroundRuntime } from '../../../composition/background';
import { CommandListener } from './CommandListener';
import { pruneExpiredTranslationHistory } from './history/prune-expired-translation-history';

const runtime = createBackgroundRuntime();

runtime.messageRouter.register();

new CommandListener(runtime.overlayService).register();

void pruneExpiredTranslationHistory(runtime.getAllTranslations);
