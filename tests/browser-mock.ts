import { mock } from 'bun:test';

// ── In-memory storage backing ────────────────────────────────────────
let store: Record<string, unknown> = {};

const storageMock = {
  get: mock(async (keys: string | string[]) => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    const result: Record<string, unknown> = {};
    for (const k of keyList) {
      if (k in store) result[k] = store[k];
    }
    return result;
  }),
  set: mock(async (items: Record<string, unknown>) => {
    Object.assign(store, items);
  }),
  remove: mock(async (keys: string | string[]) => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) delete store[k];
  }),
  clear: mock(async () => {
    store = {};
  }),
};

export const browserMock = {
  storage: { local: storageMock },
  runtime: {
    sendMessage: mock(async () => {}),
    onMessage: { addListener: mock(), removeListener: mock() },
    reload: mock(() => {}),
  },
  tabs: {
    sendMessage: mock(async () => {}),
    query: mock(async () => [{ id: 1 }]),
    captureVisibleTab: mock(async () => 'data:image/jpeg;base64,fake'),
  },
  commands: {
    onCommand: { addListener: mock() },
  },
  scripting: {
    executeScript: mock(async () => {}),
  },
};

// Intercept all imports of 'webextension-polyfill'.
// The real module uses `module.exports = browser`, so Bun resolves
// `import * as browser from 'webextension-polyfill'` as a namespace.
// We expose every property from browserMock at the top level AND
// as the default export, to cover both import styles.
mock.module('webextension-polyfill', () => ({
  ...browserMock,
  default: browserMock,
}));

// ── Mock Svelte-dependent content handler modules ────────────────────
// These must be in the preload because Bun resolves mock.module paths
// relative to the calling file, and ContentMessageRouter.ts imports
// these modules transitively. Preload runs before all test files.

mock.module(
  '../src/adapters/primary/ui/injected/toast/ToastController.svelte',
  () => ({ toastController: {} }),
);

mock.module(
  '../src/adapters/primary/ui/injected/toast/ToastController.svelte.ts',
  () => ({ toastController: {} }),
);

// Mock CSS ?inline imports that Svelte handlers use
mock.module(
  '../src/adapters/primary/ui/injected/translation-result-modal/translation-modal.css?inline',
  () => ({ default: '' }),
);
mock.module('../src/adapters/primary/ui/styles/app.css?inline', () => ({
  default: '',
}));
mock.module(
  '../src/adapters/primary/ui/injected/toast/toast.css?inline',
  () => ({ default: '' }),
);

// Mock Svelte component imports used by handlers
mock.module('svelte', () => ({
  mount: mock(),
  unmount: mock(),
}));

/** Seed the in-memory store directly (bypasses the mock spy). */
export function seedStore(data: Record<string, unknown>) {
  Object.assign(store, data);
}

/** Reset in-memory store and clear all mock call history. */
export function resetBrowserMock() {
  store = {};
  storageMock.get.mockClear();
  storageMock.set.mockClear();
  storageMock.remove.mockClear();
  storageMock.clear.mockClear();
  browserMock.runtime.sendMessage.mockClear();
  browserMock.runtime.onMessage.addListener.mockClear();
  browserMock.runtime.reload.mockClear();
  browserMock.tabs.sendMessage.mockClear();
  browserMock.tabs.query.mockClear();
  browserMock.tabs.captureVisibleTab.mockClear();
  browserMock.commands.onCommand.addListener.mockClear();
  browserMock.scripting.executeScript.mockClear();
}
