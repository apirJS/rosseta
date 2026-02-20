# Rosseta

A browser extension that translates text from any region of a webpage. Select an area on screen, and the extension captures, extracts, and translates the text using AI — all without leaving the page.

_Named after the [Rosetta Stone](https://en.wikipedia.org/wiki/Rosetta_Stone) — the ancient artifact that unlocked the mystery of Egyptian hieroglyphs. Just as the stone bridged languages carved in stone, Rosseta bridges languages rendered on screen._

> Successor of [select-and-translate](https://github.com/apirJS/select-and-translate) — rebuilt from scratch with a proper architecture.

Built with **Svelte 5**, **TypeScript**, **Tailwind CSS v4**, and a **DDD + Hexagonal architecture**.

---

## Demo

![Translation result — Japanese text translated to Indonesian with romanization](demo/usage_sample_1.png)

![Translation result — selecting a region on a webpage](demo/usage_sample_2.png)

![Popup settings — model selection and target language](demo/popup.png)

---

## Features

🖱️ **Select any area to translate** — Draw a box around any part of a webpage, including images. The extension captures the region, sends it to an AI vision model, and shows the translation in an overlay — with romanization for non-Latin scripts.

🤖 **Gemini & Groq support** — Pick your AI provider and model. Each provider's full model lineup is available, with language support filtered automatically.

🌍 **50+ languages** — Translate to and from 50+ languages, with only supported options shown per provider.

🔑 **Manage multiple API keys** — Store several keys per provider. Switch manually or enable auto-balance mode for round-robin rotation across keys.

📜 **Translation history** — Every translation is saved locally. Search, filter, and re-open past results anytime.

🌙 **Dark mode** — System detection, manual toggle, and theme sync across the popup and injected page UI.

⌨️ **Keyboard shortcut** — `Ctrl+Shift+Space` (`Cmd+Shift+Space` on macOS) to start translating instantly.

🌐 **Chrome & Firefox** — Cross-browser support via Manifest V3.

---

## Install

Download the latest `.zip` for your browser from the [Releases page](https://github.com/apirJS/rosetta/releases), then:

- **Chrome** — Go to `chrome://extensions` → enable **Developer Mode** → **Load unpacked** → select the extracted folder.
- **Firefox** — Go to `about:addons` → ⚙️ → **Install Add-on From File** → select the `.zip`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, architecture details, coding standards, and the pull request process.

---

## Roadmap

- [ ] Release to Chrome Web Store and Firefox Add-ons
- [ ] Add OpenRouter provider
- [ ] Add proxies support
- [ ] Improve UI/UX

---

## Privacy

Rosseta does **not** collect, store, or transmit any personal data to our servers.

- **API keys**, **preferences**, and **translation history** are stored locally in your browser using `browser.storage.local` and never leave your device.
- **Translation requests** (screenshots of selected areas) are sent directly from your browser to the AI provider you configured (Google Gemini or Groq) using your own API key. We have no access to this data.
- **No analytics, tracking, or telemetry** of any kind.

---

## License

This project is licensed under the [MIT License](LICENSE).
