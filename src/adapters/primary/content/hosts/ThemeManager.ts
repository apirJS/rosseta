/**
 * Manages theme state and applies it to all tracked Shadow DOM hosts.
 *
 * Encapsulates the global mutable state (currentTheme, activeModalHosts)
 * that was previously scattered as module-level variables.
 */
export class ThemeManager {
  private _current: 'dark' | 'light';
  private readonly hosts: HTMLElement[] = [];

  constructor() {
    this._current = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  get current(): 'dark' | 'light' {
    return this._current;
  }

  /**
   * Registers a host element for theme tracking.
   * Immediately applies the current theme to the host.
   */
  registerHost(host: HTMLElement): void {
    this.applyThemeToHost(host, this._current);
    this.hosts.push(host);
  }

  /**
   * Unregisters a host element from theme tracking.
   */
  unregisterHost(host: HTMLElement): void {
    const idx = this.hosts.indexOf(host);
    if (idx !== -1) this.hosts.splice(idx, 1);
  }

  /**
   * Updates the current theme and applies it to all tracked hosts.
   */
  setTheme(theme: 'dark' | 'light'): void {
    this._current = theme;
    for (const host of this.hosts) {
      this.applyThemeToHost(host, theme);
    }
  }

  private applyThemeToHost(host: HTMLElement, theme: 'dark' | 'light'): void {
    if (theme === 'dark') {
      host.classList.add('dark');
    } else {
      host.classList.remove('dark');
    }
  }
}
