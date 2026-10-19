import { mock } from 'bun:test';
import * as realAi from 'ai';

let store: Record<string, unknown> = {};

const storageMock = {
  get: mock(async (keys: string | string[] | null) => {
    if (keys === null) return { ...store };
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

mock.module('webextension-polyfill', () => ({
  ...browserMock,
  default: browserMock,
}));

mock.module(
  '../src/adapters/primary/ui/injected/toast/ToastController.svelte',
  () => ({ toastController: {} }),
);

mock.module(
  '../src/adapters/primary/ui/injected/toast/ToastController.svelte.ts',
  () => ({ toastController: {} }),
);

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

mock.module('svelte', () => ({
  mount: mock(),
  unmount: mock(),
}));

export const generateTextMock = mock(
  async (..._args: unknown[]): Promise<unknown> => {
    throw new Error('generateTextMock: no behavior configured');
  },
);

function defaultStreamText(options: unknown) {
  const generated = Promise.resolve(generateTextMock(options)).then(
    (value) =>
      value as {
        output?: unknown;
        text?: string;
        finishReason?: string;
      },
  );
  const text = generated.then(
    (value) => value.text ?? JSON.stringify(value.output ?? ''),
  );
  const output = generated.then((value) => value.output);
  // The SDK exposes eagerly observable promises; consumers attach their own handling.
  void output.catch(() => {});
  void text.catch(() => {});
  return {
    text,
    output,
    finishReason: generated.then(
      (value) => value.finishReason ?? 'stop',
      () => 'error',
    ),
    stream: (async function* () {
      try {
        const value = await text;
        yield { type: 'text-delta', id: 'text-1', text: value };
        yield { type: 'finish', finishReason: 'stop' };
      } catch (error) {
        const callback = (
          options as { onError?: (event: { error: unknown }) => void }
        ).onError;
        callback?.({ error });
        yield { type: 'error', error };
      }
    })(),
    partialOutputStream: (async function* () {
      try {
        const value = await output;
        if (value !== undefined) yield value;
      } catch {
        /* error branch carries the original cause */
      }
    })(),
  };
}

export const streamTextMock = mock(defaultStreamText);

export function resetStreamTextMock() {
  streamTextMock.mockReset();
  streamTextMock.mockImplementation(defaultStreamText);
}

mock.module('ai', () => ({
  ...realAi,
  generateText: (...args: unknown[]) =>
    (generateTextMock as unknown as (...a: unknown[]) => unknown)(...args),
  streamText: (...args: unknown[]) =>
    (streamTextMock as unknown as (...a: unknown[]) => unknown)(...args),
}));

export function seedStore(data: Record<string, unknown>) {
  Object.assign(store, data);
}

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
  generateTextMock.mockClear();
  streamTextMock.mockClear();
}
