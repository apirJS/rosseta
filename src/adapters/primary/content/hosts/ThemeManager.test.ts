import { describe, expect, test, beforeEach } from 'bun:test';

// ── Stubs ────────────────────────────────────────────────────────────
// ThemeManager accesses window.matchMedia (constructor) and
// document.createElement is used by the test to create host elements.
// Bun lacks both by default — we stub them here.

function createMinimalElement(): HTMLElement {
  const classes = new Set<string>();
  return {
    classList: {
      add(name: string) {
        classes.add(name);
      },
      remove(name: string) {
        classes.delete(name);
      },
      contains(name: string) {
        return classes.has(name);
      },
    },
  } as unknown as HTMLElement;
}

describe('ThemeManager', () => {
  beforeEach(() => {
    globalThis.window = globalThis.window || ({} as typeof globalThis.window);
    (globalThis.window as unknown as Record<string, unknown>).matchMedia = ((
      query: string,
    ) => ({
      matches: false, // default: light mode
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as typeof globalThis.window.matchMedia;
  });

  test('constructor detects light mode from matchMedia', async () => {
    const { ThemeManager } = await import('./ThemeManager');
    const tm = new ThemeManager();
    expect(tm.current).toBe('light');
  });

  test('constructor detects dark mode from matchMedia', async () => {
    (globalThis.window as unknown as Record<string, unknown>).matchMedia = ((
      query: string,
    ) => ({
      matches: true, // dark mode
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as typeof globalThis.window.matchMedia;

    const { ThemeManager } = await import('./ThemeManager');
    const tm = new ThemeManager();
    expect(tm.current).toBe('dark');
  });

  test('registerHost applies current theme and tracks host', async () => {
    const { ThemeManager } = await import('./ThemeManager');
    const tm = new ThemeManager(); // light mode
    const host = createMinimalElement();

    tm.registerHost(host);

    // Light mode → no 'dark' class
    expect(host.classList.contains('dark')).toBe(false);
  });

  test('setTheme("dark") adds dark class to all tracked hosts', async () => {
    const { ThemeManager } = await import('./ThemeManager');
    const tm = new ThemeManager();
    const host1 = createMinimalElement();
    const host2 = createMinimalElement();

    tm.registerHost(host1);
    tm.registerHost(host2);
    tm.setTheme('dark');

    expect(tm.current).toBe('dark');
    expect(host1.classList.contains('dark')).toBe(true);
    expect(host2.classList.contains('dark')).toBe(true);
  });

  test('setTheme("light") removes dark class from all tracked hosts', async () => {
    const { ThemeManager } = await import('./ThemeManager');
    const tm = new ThemeManager();
    const host = createMinimalElement();

    tm.registerHost(host);
    tm.setTheme('dark');
    expect(host.classList.contains('dark')).toBe(true);

    tm.setTheme('light');
    expect(host.classList.contains('dark')).toBe(false);
  });

  test('unregisterHost stops tracking — future setTheme does not affect it', async () => {
    const { ThemeManager } = await import('./ThemeManager');
    const tm = new ThemeManager();
    const host = createMinimalElement();

    tm.registerHost(host);
    tm.unregisterHost(host);
    tm.setTheme('dark');

    // Host should NOT have dark class since it was unregistered
    expect(host.classList.contains('dark')).toBe(false);
  });
});
