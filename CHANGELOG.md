## [1.3.1](https://github.com/apirJS/rosseta/compare/v1.3.0...v1.3.1) (2026-03-06)

### Bug Fixes

* **prompt:** segment by visual block instead of merging by language ([e544dc5](https://github.com/apirJS/rosseta/commit/e544dc51d7109a6dc5b820ba1eca26e10d84f6f5))

## [1.3.0](https://github.com/apirJS/rosseta/compare/v1.2.1...v1.3.0) (2026-03-02)

### Features

* **provider:** add Z.ai provider integration ([2d1cae4](https://github.com/apirJS/rosseta/commit/2d1cae411b3f3fcfd1dc0913845d86b9045c9810))
* **provider:** change default Gemini model to gemini-2.5-flash ([34f9d3e](https://github.com/apirJS/rosseta/commit/34f9d3e23207f2d55dec96fdc565a62f137a8c69))
* **ui:** add version display and GitHub link to app menu ([b07e1b3](https://github.com/apirJS/rosseta/commit/b07e1b3ba7982f2d0a9c65b3be4943738e2c85f6))

### Bug Fixes

* **storage:** add Z.ai to credential storage schema and fix deserialization ([0d03876](https://github.com/apirJS/rosseta/commit/0d03876f48f7c0c082ba979798a7950cea68c31e))
* **ui:** use dynamic provider labels instead of binary groq/gemini checks ([7ae3bbf](https://github.com/apirJS/rosseta/commit/7ae3bbf7c65b0c0c8ca182bcb2d6e3cd7cae00df))

## [1.2.1](https://github.com/apirJS/rosseta/compare/v1.2.0...v1.2.1) (2026-03-02)

### Bug Fixes

* correct error codes, remove deprecated model, and refactor domain objects ([05c48a6](https://github.com/apirJS/rosseta/commit/05c48a6cb5de8b0775a61676c3694fc07c5e7d66))
* harden secondary adapters with timeouts, logging, and validation ([6c517ca](https://github.com/apirJS/rosseta/commit/6c517ca3d94f2e87471442e052a4abf1da85f01f))
* resolve race conditions, correct content script path, and share OverlayService ([b7efac8](https://github.com/apirJS/rosseta/commit/b7efac8729acbb004e9d2ba2b32840be29739460))

## [1.2.0](https://github.com/apirJS/rosseta/compare/v1.1.0...v1.2.0) (2026-02-24)

### Features

* **ui:** add retry on error toast, undo delete, view transitions, and proxy indicator ([c34e0b1](https://github.com/apirJS/rosseta/commit/c34e0b1a769b0c7bd3c7f5d7b3cfeb670141fd3a))

### Bug Fixes

* remove tabs permission and re-enable full publish pipeline ([4d7d4d8](https://github.com/apirJS/rosseta/commit/4d7d4d8a6fbe17a81ccc34e240d6786c4dee399b))

## [1.2.0](https://github.com/apirJS/rosseta/compare/v1.1.0...v1.2.0) (2026-02-24)

### Features

* **ui:** add retry on error toast, undo delete, view transitions, and proxy indicator ([c34e0b1](https://github.com/apirJS/rosseta/commit/c34e0b1a769b0c7bd3c7f5d7b3cfeb670141fd3a))

### Bug Fixes

* remove tabs permission and re-enable full publish pipeline ([4d7d4d8](https://github.com/apirJS/rosseta/commit/4d7d4d8a6fbe17a81ccc34e240d6786c4dee399b))

## [1.2.0](https://github.com/apirJS/rosseta/compare/v1.1.1...v1.2.0) (2026-02-24)

### Features

* **ui:** add retry on error toast, undo delete, view transitions, and proxy indicator ([c34e0b1](https://github.com/apirJS/rosseta/commit/c34e0b1a769b0c7bd3c7f5d7b3cfeb670141fd3a))

## [1.1.1](https://github.com/apirJS/rosseta/compare/v1.1.0...v1.1.1) (2026-02-24)

### Bug Fixes

* remove tabs permission and re-enable full publish pipeline ([4d7d4d8](https://github.com/apirJS/rosseta/commit/4d7d4d8a6fbe17a81ccc34e240d6786c4dee399b))

## [1.1.0](https://github.com/apirJS/rosseta/compare/v1.0.1...v1.1.0) (2026-02-23)

### Features

* add proxy URL support with health check ([8d220bd](https://github.com/apirJS/rosseta/commit/8d220bd9e3d59d86af8a3179aea8987b4818cb57))
* **ui:** dynamic provider cycling in login and manage-keys pages ([73dedd4](https://github.com/apirJS/rosseta/commit/73dedd40b81e69247f2313ad8f3a4d52d1bc194c))

### Bug Fixes

* **ci:** temporarily disable Firefox AMO publish ([ab6a122](https://github.com/apirJS/rosseta/commit/ab6a1221afa54b965fbf9580f92aa3af54aaa989))
* **ci:** update publishCmd for chrome-webstore-upload-cli v3 and web-ext v8 ([979c950](https://github.com/apirJS/rosseta/commit/979c9509cc58a45c9afdbc16b63ccf0fff079879))

## [1.1.0](https://github.com/apirJS/rosseta/compare/v1.0.1...v1.1.0) (2026-02-23)

### Features

* add proxy URL support with health check ([8d220bd](https://github.com/apirJS/rosseta/commit/8d220bd9e3d59d86af8a3179aea8987b4818cb57))
* **ui:** dynamic provider cycling in login and manage-keys pages ([73dedd4](https://github.com/apirJS/rosseta/commit/73dedd40b81e69247f2313ad8f3a4d52d1bc194c))

### Bug Fixes

* **ci:** update publishCmd for chrome-webstore-upload-cli v3 and web-ext v8 ([979c950](https://github.com/apirJS/rosseta/commit/979c9509cc58a45c9afdbc16b63ccf0fff079879))

## [1.0.1](https://github.com/apirJS/rosseta/compare/v1.0.0...v1.0.1) (2026-02-21)

### Bug Fixes

* **ui:** display actual user-configured shortcut in translate button ([c6fe76c](https://github.com/apirJS/rosseta/commit/c6fe76c14487038e98cf02624b075a83c8001309))

## 1.0.0 (2026-02-20)

### ⚠ BREAKING CHANGES

* initial release

### Features

* initial release ([93c58ee](https://github.com/apirJS/rosseta/commit/93c58eecd73e297204cdeec4598fdfa62cd2d60b))
