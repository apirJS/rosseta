# <img src="public/icons/icon-48.png" width="32" height="32" alt="Rosseta icon" style="vertical-align: middle;"> Rosseta

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/flbdkalgeiekpnchpakdpaabcehpnlln?style=flat&logo=googlechrome&logoColor=white&label=Chrome%20Web%20Store)](https://chromewebstore.google.com/detail/rosseta/flbdkalgeiekpnchpakdpaabcehpnlln) [![Firefox Add-ons](https://img.shields.io/amo/v/rosseta?style=flat&logo=firefox&logoColor=white&label=Firefox%20Add-ons)](https://addons.mozilla.org/en-US/firefox/addon/rosseta/)

A browser extension that translates text from any region of a webpage. Draw a selection box over the text, images, or UI elements on screen. The extension captures that region as a screenshot, sends it to a vision LLM for OCR, and renders the translated text in an overlay on the page.

Named after the [Rosetta Stone](https://en.wikipedia.org/wiki/Rosetta_Stone). Successor of [select-and-translate](https://github.com/apirJS/select-and-translate), rebuilt from scratch.

---

## Demo

![Rosseta demo banner 1](demo/chrome_banner_big_1.png)

![Rosseta demo banner 2](demo/chrome_banner_big_2.png)

![Rosseta demo banner 4](demo/chrome_banner_big_4.png)

![Rosseta demo banner 3](demo/chrome_banner_big_3.png)

---

## Features

### Region-based translation

Select any area of a page by drawing a rectangle over it. This works on regular text, embedded images, video subtitles, UI labels, buttons, or anything else visible on screen. The extension screenshots the selected region, runs OCR through a vision model, segments the text by language, and displays both the original and translated text in an in-page modal.

### Romanization

For non-Latin scripts (Japanese, Chinese, Korean, Arabic, Thai, etc.), the translation result includes romanization alongside the original text. For example, Japanese text shows its reading in romaji.

### Context description

Each translation result can include a brief contextual summary describing what was captured. This is written in the target language. It can be turned off in settings to reduce token usage.

### Multi-segment output

The OCR output is segmented by visually distinct blocks, not merged into a single blob. Each heading, label, timestamp, button, and caption is its own segment with its own language tag and translation. Mixed-language text within a single block is split by language.

### 12 built-in AI providers

Rosseta supports the following providers out of the box: Google, Groq, xAI, OpenAI, Anthropic, Mistral, DeepInfra, Z.ai, OpenRouter, OpenCode, Hugging Face, and PuterJS.

Model lists are fetched directly from the provider's API at runtime. You can also add models manually.

To use PuterJS, create an auth token in [Puter account settings](https://puter.com/#account), then add it from **Manage API Keys** with PuterJS selected. Puter's popup sign-in flow does not support browser-extension URLs, so Rosseta uses the token as the provider credential.

### Custom provider endpoints

Point Rosseta at any OpenAI-compatible or Anthropic-compatible API by selecting the protocol and providing a base URL, optional custom headers, and optional query parameters. These values are validated when saved and used for both translation and model discovery. Useful for self-hosted models, corporate proxies, or providers not yet built in.

### Multiple API keys per provider

You can store multiple API keys for each provider. The extension supports round-robin key rotation across keys for the same provider, cycling to the next key after each request.

### Translation history

Every translation is automatically saved locally. History is searchable and can be cleared individually or all at once.

### Settings backup

Export your complete setup to a JSON file and restore it later from the Settings page. Backups include provider credentials (including API keys and Puter tokens), custom providers, model lists and selections, language and theme preferences, key rotation settings, and translation history.

### Keyboard shortcut

Default shortcut: `Ctrl+Shift+Y` (Windows/Linux) or `Cmd+Shift+Y` (macOS). This triggers the selection overlay directly without opening the popup. The shortcut is customizable through your browser's extension shortcut settings.

### Cross-browser

Runs on both Chrome and Firefox as a Manifest V3 extension.

---

## Install

- **Chrome**: [Install from Chrome Web Store](https://chromewebstore.google.com/detail/rosseta/flbdkalgeiekpnchpakdpaabcehpnlln)
- **Firefox**: [Install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/rosseta/)

---

## Tips for free users

- Explore [awesome-free-llm-apis](https://github.com/mnfst/awesome-free-llm-apis) for providers offering free API access or trial quotas. Limits and availability can change, so check each provider's current terms before adding a key.
- Use **PuterJS** to access its supported models with a Puter account token. Create a token in [Puter account settings](https://puter.com/#account), add it under **Manage API Keys**, then fetch and select a model under **Manage Models**.
- Choose a model that supports **image or vision input**. Rosseta sends a screenshot of the selected region, so text-only models cannot perform the translation.
- If a provider's model list is incomplete, add a compatible vision model manually from **Manage Models**.

---

## Tech stack

Built with Svelte 5 (runes), TypeScript (strict, no `any`), Tailwind CSS v4, and a DDD + Hexagonal (Ports & Adapters) architecture. Most translation calls go through the Vercel AI SDK (`@ai-sdk/*`).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, architecture details, coding standards, and the pull request process.

---

## Roadmap

- [x] Release to Chrome Web Store and Firefox Add-ons
- [ ] More AI providers


---

## Privacy

Rosseta does **not** collect, store, or transmit any personal data to our servers.

- **Provider credentials** (including API keys and Puter auth tokens), **preferences**, and **translation history** are stored locally in your browser using `browser.storage.local` and never leave your device.
- **Translation requests** (screenshots of selected areas) are sent directly from your browser to the AI provider you configured, using your own provider credential. We have no access to this data.
- **No analytics, tracking, or telemetry** of any kind.

---

## License

This project is licensed under the [MIT License](LICENSE).
