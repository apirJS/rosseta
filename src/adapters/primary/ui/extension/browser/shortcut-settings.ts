import * as browser from 'webextension-polyfill';

const FIREFOX_SHORTCUT_HELP =
  'https://support.mozilla.org/en-US/kb/manage-extension-shortcuts-firefox';

/** Chromium forks share Chrome's extensions page unless they expose a different UI. */
export function shortcutSettingsUrl(): string {
  if (browser.runtime.getURL('').startsWith('moz-extension:'))
    return FIREFOX_SHORTCUT_HELP;

  const agent = navigator.userAgent;

  if (/\bEdg(?:A|iOS)?\//.test(agent)) return 'edge://extensions/shortcuts';
  // Opera's global shortcut editor also manages installed extension commands.
  // https://blogs.opera.com/tips-and-tricks/2023/04/working-faster-with-keyboard-shortcuts-in-opera/
  if (/\b(?:OPR|Opera)\//.test(agent))
    return 'opera://settings/keyboardShortcuts';
  if (/\bBrave\//.test(agent)) return 'brave://extensions/shortcuts';

  return 'chrome://extensions/shortcuts';
}

export async function openShortcutSettings(): Promise<void> {
  // Firefox 137+ can open and focus this extension's shortcut editor directly.
  // https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/commands/openShortcutSettings
  if (typeof browser.commands.openShortcutSettings === 'function') {
    try {
      await browser.commands.openShortcutSettings();

      return;
    } catch {
      // Fall back to the browser's settings page or Firefox's official instructions.
    }
  }

  // Firefox forbids tabs.create({ url: 'about:addons' }); use instructions when
  // its native shortcut editor is unavailable. Chromium allows its settings URL.
  await browser.tabs.create({ url: shortcutSettingsUrl() });
}
