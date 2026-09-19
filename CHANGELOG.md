## [2.1.0](https://github.com/apirJS/rosseta/compare/v2.0.0...v2.1.0) (2026-09-19)

### Features

* export import settings ([#5](https://github.com/apirJS/rosseta/issues/5)) ([10900cc](https://github.com/apirJS/rosseta/commit/10900cc77e555a07579fab9b847d7a0cbf3ebe44))

### Bug Fixes

* broken tests because of new feats ([e853d11](https://github.com/apirJS/rosseta/commit/e853d11605da55bf4f2df35de911d8b817d086b2))
* failing UI tests ([#7](https://github.com/apirJS/rosseta/issues/7)) ([533dbb7](https://github.com/apirJS/rosseta/commit/533dbb73394bb83518647f2bb4ddb4babc6328e6))

## [2.0.0](https://github.com/apirJS/rosseta/compare/v1.3.1...v2.0.0) (2026-09-16)

### ⚠ BREAKING CHANGES

* the auth/login flow and all pre-rewrite storage formats
are replaced by the multi-provider credential system.

* feat: add Z.ai and OpenRouter providers, description toggle, and manage-keys redesign

- add zai and openrouter as built-in providers: translation adapters,
  registry entries, OpenAI-compatible model fetching, badge colors, and
  API key URLs (@ai-sdk/zai, @openrouter/ai-sdk-provider)
- add includeDescription preference with a custom Checkbox component on
  the home page; when disabled, the prompt skips the contextual summary
  and the LLM returns an empty description, saving output tokens
- redesign Manage API Keys to match Manage Models: provider select in the
  header, single search-or-add input with a dashed add-suggestion row
  (masked key), key list scoped to the selected provider, and provider
  badge removed from list items
- change the default start-extension shortcut from Ctrl+Space to Ctrl+Shift+Y

* feat: add Z.ai and OpenRouter providers, description toggle, and manage-keys redesign

- add zai, openrouter, and opencode as built-in providers: translation
  adapters, registry entries, OpenAI-compatible model fetching, badge
  colors, and API key URLs (@ai-sdk/zai, @openrouter/ai-sdk-provider;
  opencode reuses @ai-sdk/openai-compatible against
  https://opencode.ai/zen/v1)
- add includeDescription preference with a custom Checkbox component on
  the home page; when disabled, the prompt skips the contextual summary
  and the LLM returns an empty description, saving output tokens
- redesign Manage API Keys to match Manage Models: provider select in the
  header, single search-or-add input with a dashed add-suggestion row
  (masked key), key list scoped to the selected provider, and provider
  badge removed from list items
- change the default start-extension shortcut from Ctrl+Space to Ctrl+Shift+Y
- handle stale model selections: new UserPreferences.resolveModelIdFor
  validates the saved/default model against the available list;
  TranslateImageHandler repairs and persists a stale selection before
  translating, and FetchModelsUseCase repairs the selection after a fetch
  removes the selected model

* feat: add hugging face provider, retry mechanism for non structured-output model

* chore: change legacy initiation method for Google provider

* feat: improve history search, remove duplicated Add button

* refactor: one component serve one purpose, separation between smart & dumb components

* ci: add [skip publish] flag detection

* fix: missing back buttons on manage keys and models pages

* docs: readme, and demos

* feat: group text visually, simplifying prompt

* fix: honor manual key choice and unstructured-output fallback

Manage Keys' "set active" now switches the key-selection mode back to
manual before pinning the credential, so an explicit key choice is no
longer ignored while auto-balance is enabled. The ACTIVE badge is hidden
unless the mode is manual, matching the home dropdown.

Unwrap RetryError before classifying generation failures: retryable
errors (429, 5xx, relayed upstream rejections) are only wrapped after
retries are exhausted, so rate limits, server errors, vision rejections
and json_schema fallbacks were misreported or skipped. Retry the repair
prompt when the plain (non-structured) path returns unparseable JSON,
matching the structured path.

Fix the stale auto-balance UI test to seed the two keys the round robin
requires and cover the single-key fallback.

* docs: update CONTRIBUTING.md

* ci: relase as draft first, so I can manually approve for store publish

* docs: update readme

* fix: pressing Esc shouldn't close the result modal, pressing Esc should cancel overlay

* fix(build): use oxc minifier instead of deprecated esbuild

* ci: use built-in GITHUB_TOKEN for semantic-release
* the auth/login flow and all pre-rewrite storage formats
are replaced by the multi-provider credential system.

* feat: add Z.ai and OpenRouter providers, description toggle, and manage-keys redesign

- add zai and openrouter as built-in providers: translation adapters,
  registry entries, OpenAI-compatible model fetching, badge colors, and
  API key URLs (@ai-sdk/zai, @openrouter/ai-sdk-provider)
- add includeDescription preference with a custom Checkbox component on
  the home page; when disabled, the prompt skips the contextual summary
  and the LLM returns an empty description, saving output tokens
- redesign Manage API Keys to match Manage Models: provider select in the
  header, single search-or-add input with a dashed add-suggestion row
  (masked key), key list scoped to the selected provider, and provider
  badge removed from list items
- change the default start-extension shortcut from Ctrl+Space to Ctrl+Shift+Y

* feat: add Z.ai and OpenRouter providers, description toggle, and manage-keys redesign

- add zai, openrouter, and opencode as built-in providers: translation
  adapters, registry entries, OpenAI-compatible model fetching, badge
  colors, and API key URLs (@ai-sdk/zai, @openrouter/ai-sdk-provider;
  opencode reuses @ai-sdk/openai-compatible against
  https://opencode.ai/zen/v1)
- add includeDescription preference with a custom Checkbox component on
  the home page; when disabled, the prompt skips the contextual summary
  and the LLM returns an empty description, saving output tokens
- redesign Manage API Keys to match Manage Models: provider select in the
  header, single search-or-add input with a dashed add-suggestion row
  (masked key), key list scoped to the selected provider, and provider
  badge removed from list items
- change the default start-extension shortcut from Ctrl+Space to Ctrl+Shift+Y
- handle stale model selections: new UserPreferences.resolveModelIdFor
  validates the saved/default model against the available list;
  TranslateImageHandler repairs and persists a stale selection before
  translating, and FetchModelsUseCase repairs the selection after a fetch
  removes the selected model

* feat: add hugging face provider, retry mechanism for non structured-output model

* chore: change legacy initiation method for Google provider

* feat: improve history search, remove duplicated Add button

* refactor: one component serve one purpose, separation between smart & dumb components

* ci: add [skip publish] flag detection

* fix: missing back buttons on manage keys and models pages

* docs: readme, and demos

* feat: group text visually, simplifying prompt

* fix: honor manual key choice and unstructured-output fallback

Manage Keys' "set active" now switches the key-selection mode back to
manual before pinning the credential, so an explicit key choice is no
longer ignored while auto-balance is enabled. The ACTIVE badge is hidden
unless the mode is manual, matching the home dropdown.

Unwrap RetryError before classifying generation failures: retryable
errors (429, 5xx, relayed upstream rejections) are only wrapped after
retries are exhausted, so rate limits, server errors, vision rejections
and json_schema fallbacks were misreported or skipped. Retry the repair
prompt when the plain (non-structured) path returns unparseable JSON,
matching the structured path.

Fix the stale auto-balance UI test to seed the two keys the round robin
requires and cover the single-key fallback.

* docs: update CONTRIBUTING.md

* ci: relase as draft first, so I can manually approve for store publish

* docs: update readme

* fix: pressing Esc shouldn't close the result modal, pressing Esc should cancel overlay

* fix(build): use oxc minifier instead of deprecated esbuild
* the auth/login flow and all pre-rewrite storage formats
are replaced by the multi-provider credential system.

* feat: add Z.ai and OpenRouter providers, description toggle, and manage-keys redesign

- add zai and openrouter as built-in providers: translation adapters,
  registry entries, OpenAI-compatible model fetching, badge colors, and
  API key URLs (@ai-sdk/zai, @openrouter/ai-sdk-provider)
- add includeDescription preference with a custom Checkbox component on
  the home page; when disabled, the prompt skips the contextual summary
  and the LLM returns an empty description, saving output tokens
- redesign Manage API Keys to match Manage Models: provider select in the
  header, single search-or-add input with a dashed add-suggestion row
  (masked key), key list scoped to the selected provider, and provider
  badge removed from list items
- change the default start-extension shortcut from Ctrl+Space to Ctrl+Shift+Y

* feat: add Z.ai and OpenRouter providers, description toggle, and manage-keys redesign

- add zai, openrouter, and opencode as built-in providers: translation
  adapters, registry entries, OpenAI-compatible model fetching, badge
  colors, and API key URLs (@ai-sdk/zai, @openrouter/ai-sdk-provider;
  opencode reuses @ai-sdk/openai-compatible against
  https://opencode.ai/zen/v1)
- add includeDescription preference with a custom Checkbox component on
  the home page; when disabled, the prompt skips the contextual summary
  and the LLM returns an empty description, saving output tokens
- redesign Manage API Keys to match Manage Models: provider select in the
  header, single search-or-add input with a dashed add-suggestion row
  (masked key), key list scoped to the selected provider, and provider
  badge removed from list items
- change the default start-extension shortcut from Ctrl+Space to Ctrl+Shift+Y
- handle stale model selections: new UserPreferences.resolveModelIdFor
  validates the saved/default model against the available list;
  TranslateImageHandler repairs and persists a stale selection before
  translating, and FetchModelsUseCase repairs the selection after a fetch
  removes the selected model

* feat: add hugging face provider, retry mechanism for non structured-output model

* chore: change legacy initiation method for Google provider

* feat: improve history search, remove duplicated Add button

* refactor: one component serve one purpose, separation between smart & dumb components

* ci: add [skip publish] flag detection

* fix: missing back buttons on manage keys and models pages

* docs: readme, and demos

* feat: group text visually, simplifying prompt

* fix: honor manual key choice and unstructured-output fallback

Manage Keys' "set active" now switches the key-selection mode back to
manual before pinning the credential, so an explicit key choice is no
longer ignored while auto-balance is enabled. The ACTIVE badge is hidden
unless the mode is manual, matching the home dropdown.

Unwrap RetryError before classifying generation failures: retryable
errors (429, 5xx, relayed upstream rejections) are only wrapped after
retries are exhausted, so rate limits, server errors, vision rejections
and json_schema fallbacks were misreported or skipped. Retry the repair
prompt when the plain (non-structured) path returns unparseable JSON,
matching the structured path.

Fix the stale auto-balance UI test to seed the two keys the round robin
requires and cover the single-key fallback.

* docs: update CONTRIBUTING.md

* ci: relase as draft first, so I can manually approve for store publish

* docs: update readme

* fix: pressing Esc shouldn't close the result modal, pressing Esc should cancel overlay

### Features

* rewrite how we port and interact with LLM provider ([#1](https://github.com/apirJS/rosseta/issues/1)) ([933959f](https://github.com/apirJS/rosseta/commit/933959f000877f3022e616c37ad584600999bb49))
* rewrite how we use and port a LLM provider ([#2](https://github.com/apirJS/rosseta/issues/2)) ([54c7d9f](https://github.com/apirJS/rosseta/commit/54c7d9f9cd1f0a77a38eda31ac8a11b630a80224))

### Bug Fixes

* **deps:** revert conventionalcommits preset to v9 for semantic-release compatibility ([#4](https://github.com/apirJS/rosseta/issues/4)) ([3609664](https://github.com/apirJS/rosseta/commit/3609664070906d3b9aecd075c08aeb34c779f614))

### Continuous Integration

* use built-in GITHUB_TOKEN for semantic-release ([#3](https://github.com/apirJS/rosseta/issues/3)) ([8a7dd70](https://github.com/apirJS/rosseta/commit/8a7dd70709327647b94f0b0ae8efcef522efbf98))

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
