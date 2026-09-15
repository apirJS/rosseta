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

  registerHost(host: HTMLElement): void {
    this.applyThemeToHost(host, this._current);
    this.hosts.push(host);
  }

  unregisterHost(host: HTMLElement): void {
    const idx = this.hosts.indexOf(host);
    if (idx !== -1) this.hosts.splice(idx, 1);
  }

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
