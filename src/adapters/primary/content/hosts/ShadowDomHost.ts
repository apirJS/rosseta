export interface ShadowDomHostOptions {
  hostId: string;
  styles: string;
  hostStyles?: Partial<CSSStyleDeclaration>;
  containerStyles?: Partial<CSSStyleDeclaration>;
}

export interface ShadowDomHostResult {
  host: HTMLElement;
  shadowRoot: ShadowRoot;
  appContainer: HTMLElement;
}

export function createShadowDomHost(
  options: ShadowDomHostOptions,
): ShadowDomHostResult {
  const host = document.createElement('div');
  host.id = options.hostId;

  if (options.hostStyles) {
    Object.assign(host.style, options.hostStyles);
  }

  const shadowRoot = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = options.styles;
  shadowRoot.appendChild(styleEl);

  const appContainer = document.createElement('div');
  if (options.containerStyles) {
    Object.assign(appContainer.style, options.containerStyles);
  }
  shadowRoot.appendChild(appContainer);

  document.body.appendChild(host);

  return { host, shadowRoot, appContainer };
}
