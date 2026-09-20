export class ThemeManager {
  private currentTheme: 'dark' | 'light';
  private readonly hosts: HTMLElement[] = [];

  constructor() {
    this.currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  get current(): 'dark' | 'light' {
    return this.currentTheme;
  }

  registerHost(host: HTMLElement): void {
    this.applyThemeToHost(host, this.currentTheme);
    this.hosts.push(host);
  }

  unregisterHost(host: HTMLElement): void {
    const idx = this.hosts.indexOf(host);
    if (idx !== -1) this.hosts.splice(idx, 1);
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.currentTheme = theme;
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
