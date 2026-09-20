# Contributing to Rosseta

Thank you for your interest in contributing! This document provides everything you need to get started, from setting up your environment to submitting your first pull request.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Pull Request Checks](#pull-request-checks)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Adding a New AI Provider](#adding-a-new-ai-provider)

---

## Prerequisites

| Tool                 | Version | Purpose                               |
| -------------------- | ------- | ------------------------------------- |
| **Bun**              | ≥ 1.0   | Runtime, package manager, test runner |
| **Node.js**          | ≥ 18    | Required by some Vite tooling         |
| **Chrome / Firefox** | Latest  | Extension testing                     |

## Getting Started

```bash
# 1. Fork & clone
git clone https://github.com/<your-fork>/rosseta.git
cd rosseta

# 2. Install dependencies
bun install

# 3. Start dev build (Chrome)
bun run build:dev:chrome

# 4. Load the extension
#    Chrome  → chrome://extensions → "Load unpacked" → select dist/chrome
#    Firefox → about:debugging → "Load Temporary Add-on" → select dist/firefox/manifest.json
```

## Architecture Overview

This project follows **Domain-Driven Design (DDD)** with a **Hexagonal (Ports & Adapters)** architecture. All dependencies point inward — adapters depend on the core, never the other way around.

```
┌────────────────────────────────────────────────────────┐
│                      Adapters                          │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │   Primary     │  │ Secondary│  │   Primary (UI)   │  │
│  │  background   │  │  @ai-sdk │  │  Svelte 5 + TW4  │  │
│  │  content      │  │  clients │  │  extension popup │  │
│  │              │  │  storage  │  │  injected overlay│  │
│  │              │  │  fetching │  │                  │  │
│  └──────┬───────┘  └────┬─────┘  └────────┬─────────┘  │
│         │               │                 │             │
│ ────────┼───────────────┼─────────────────┼──────────── │
│         ▼               ▼                 ▼             │
│  ┌─────────────────────────────────────────────────┐    │
│  │                    Core                          │    │
│  │  ┌────────────┐ ┌────────────┐ ┌─────────────┐  │    │
│  │  │   Domain    │ │Application │ │    Ports     │  │    │
│  │  │ (entities,  │ │(use cases) │ │ (inbound /   │  │    │
│  │  │  value objs)│ │            │ │  outbound)   │  │    │
│  │  └────────────┘ └────────────┘ └─────────────┘  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │                   Shared                         │    │
│  │  errors · types · DI container · messaging       │    │
│  └─────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

**Key principles:**

- **Domain layer** — Pure value objects and entities with no framework dependencies
- **Ports** — Interfaces that define boundaries (`ITranslationStorage`, `ICredentialStorage`, etc.)
- **Adapters** — Concrete implementations of ports (browser storage, API clients, UI components)
- **Use cases** — Application logic orchestrating domain objects through ports

## Project Structure

```
src/
├── core/                          # Framework-free business logic
│   ├── domain/
│   │   ├── credential/            # ApiKey, Credential, Credentials, Provider, KeySelectionMode
│   │   ├── image/                 # EncodedImage
│   │   ├── preferences/           # UserPreferences, AiModel, Theme
│   │   ├── provider/              # ProviderRegistry, CustomProviderConfig
│   │   └── translation/           # Translation, Language, TextSegment
│   ├── application/               # Use cases (one class per action)
│   │   ├── auth/                  # Add/Remove API keys, active key, key-selection mode
│   │   ├── command/               # Keyboard shortcut lookup
│   │   ├── models/                # Fetch/Load/Add/Remove/Clear models
│   │   ├── preferences/           # Get/Update user preferences
│   │   ├── provider/              # Custom provider config CRUD
│   │   └── translation/           # Translate, Save, Get, Delete, ClearAll
│   └── ports/
│       ├── inbound/               # Use case interfaces (driven side)
│       └── outbound/              # Storage & service interfaces (driving side)
│
├── adapters/
│   ├── primary/                   # Entry points (driving adapters)
│   │   ├── background/            # Service worker handlers (translation, model fetch)
│   │   ├── content/               # Content script (overlay, toast, modal)
│   │   └── ui/
│   │       ├── extension/         # Popup UI (pages, components)
│   │       ├── injected/          # In-page overlay, toast, translation modal
│   │       └── shared/            # Hooks, context, constants, components
│   └── secondary/                 # Infrastructure (driven adapters)
│       ├── google/ groq/ xai/     # @ai-sdk/* translation adapters (thin)
│       ├── openai/ anthropic/ ... # one directory per provider
│       ├── huggingface/ opencode/ # incl. Hugging Face + OpenCode
│       ├── puter/                 # Puter SDK translation adapter
│       ├── openai-compatible/     # custom OpenAI-compatible providers
│       ├── anthropic-compatible/  # custom Anthropic-compatible providers
│       ├── model-fetchers/        # ModelFetchService (provider /models APIs)
│       ├── shared/                # executeTranslation, prompt, schema,
│       │                          # parse-translation-json, response mapper
│       └── storage/               # Browser storage adapters (Zod-validated)
│
├── shared/                        # Cross-cutting concerns
│   ├── di/                        # Dependency injection container
│   ├── errors/                    # AppError hierarchy (typed error codes)
│   ├── messaging/                 # Runtime message helpers
│   └── types/                     # Result<T, E>, shared type utilities
│
└── tests/
    └── fakes/                     # In-memory test doubles (one per outbound port)
```

## Development Workflow

### Available Scripts

| Command                     | Description                                     |
| --------------------------- | ----------------------------------------------- |
| `bun run dev:chrome`        | Vite dev server (true HMR for the popup)        |
| `bun run dev:firefox`       | Vite dev server for Firefox (no popup HMR)      |
| `bun run build:dev:chrome`  | Development build with watch mode (Chrome)      |
| `bun run build:dev:firefox` | Development build with watch mode (Firefox)     |
| `bun run build:prod`        | Production build for both browsers              |
| `bun run lint`              | Lint TypeScript, JavaScript, and Svelte files with Oxlint |
| `bun run test:logic`        | Domain, application, background, content, adapter tests |
| `bun run test:ui`           | Svelte component + `*.svelte.ts` controller tests (Vitest + jsdom) |
| `bun run test`              | Run all tests                                   |
| `bun run check`             | Type-check Svelte files and Node config         |

> [!IMPORTANT]
> Tests run on two runners, split by **path**, not by config. A file in the wrong
> place silently never runs:
>
> - `bun run test:logic` (bun) covers `src/shared`, `src/core`,
>   `src/adapters/primary/{background,content}`, `src/adapters/secondary`.
> - `bun run test:ui` (vitest) covers `src/adapters/primary/ui` only — that is
>   where the Svelte compiler is needed for `$state`/`$derived` in `*.svelte.ts`.
>
> Import from `bun:test` in the first scope and from `vitest` in the second.

### Recommended Dev Loop

```bash
# Terminal 1: Watch build
bun run build:dev:chrome

# Terminal 2: Run logic tests on change
bun run test:logic

# Before committing
bun run check && bun run test
```

## Pull Request Checks

`.github/workflows/pr-checks.yml` runs for opened, updated, reopened, and
ready-for-review pull requests. It runs four checks for each approved PR:

- `lint` — Oxlint diagnostics with warnings treated as failures
- `test` — the full logic and UI test suite
- `typecheck` — Svelte and TypeScript checks
- `build` — production Chrome and Firefox builds

The `Verify & Test` job aggregates those jobs into the status required by the
`main` branch ruleset. It fails if any individual check fails or is skipped.

GitHub's outside-collaborator approval policy holds workflow runs from other
authors before a runner checks out or executes their code. Once a maintainer
approves the run, the same checks proceed normally. `.github/CODEOWNERS`
requires review from `@apirJS` for every file.

## Coding Standards

### TypeScript

- **Strict mode** — No `any` types. Use `unknown` when the type is genuinely unknown.
- **Imports** — Use `import type` for type-only imports to enable proper tree-shaking.
- **Value objects** — Domain types are immutable. Use `create()` / `fromRaw()` factory methods, never raw constructors for validation.
- **Result type** — Never throw exceptions for expected failures. Return `Result<T, AppError>` from use cases and storage adapters.

```typescript
// ✅ Good — Result-based error handling
async execute(): Promise<Result<void, AppError>> {
  return this.storage.clear();
}

// ❌ Bad — throwing for expected failures
async execute(): Promise<void> {
  throw new Error('Storage failed');
}
```

### Svelte

- **Svelte 5 runes** — Use `$state`, `$derived`, `$effect`, and `$props` exclusively. No legacy `$:` reactive statements.
- **Component naming** — PascalCase filenames matching the component name (`ModelSelector.svelte`).
- **Props interface** — Define a `Props` interface in every component for type safety.
- **Context** — Use typed Svelte context (`setContext` / `getContext`) for dependency injection, never global stores.

### Styling

- **Tailwind CSS v4** — Use utility classes in templates. Avoid inline styles.
- **Design tokens** — Use semantic color names (`bg-background`, `text-foreground`, `border-border`) for theme compatibility.
- **Dark mode** — Supported via class-based toggling. Always verify both themes.

### File Organization

- **One use case per file** — Each use case gets its own file and test file.
- **Port interfaces** — Prefixed with `I` (e.g., `ITranslationStorage`).
- **Fakes over mocks** — Use in-memory fakes from `tests/fakes/` for testing. Use mocks only for verifying interaction patterns.

## Testing

### Test Structure

Tests live alongside their source files with the `.test.ts` suffix:

```
ClearAllTranslationsUseCase.ts
ClearAllTranslationsUseCase.test.ts
```

### Naming Convention

```typescript
describe('Application: ClearAllTranslationsUseCase', () => {
  test('clears all translations from storage', async () => { ... });
  test('succeeds when storage is already empty', async () => { ... });
  test('fails when storage.clear() fails', async () => { ... });
});
```

Use descriptive prefixes to indicate the layer:

- `Domain:` for value objects and entities
- `Application:` for use cases
- `Adapter:` for storage, API, and UI adapters
- `Service:` for application services
- `UI Controller:` for `*Controller.svelte.ts` factories (vitest scope)

### Running Tests

```bash
# All tests
bun run test

# Logic tests only (fast, no DOM)
bun run test:logic

# UI component tests only
bun run test:ui

# Single file
bun test src/core/application/translation/ClearAllTranslationsUseCase.test.ts
```

### Writing Tests

1. **Use fakes** — Prefer `FakeTranslationStorage`, `FakeCredentialStorage`, etc. over ad-hoc mocks.
2. **Test the contract** — Focus on inputs and outputs, not internal implementation.
3. **Cover the error path** — Every use case test should include a failure scenario.
4. **No network calls** — All external dependencies must be faked or mocked.

## Commit Guidelines

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type       | When to use                                 |
| ---------- | ------------------------------------------- |
| `feat`     | New feature or capability                   |
| `fix`      | Bug fix                                     |
| `refactor` | Code change that is neither fix nor feature |
| `test`     | Adding or updating tests                    |
| `docs`     | Documentation only changes                  |
| `chore`    | Build, CI, tooling, dependencies            |
| `style`    | Formatting, whitespace (no logic change)    |

### Examples

```
feat(auth): add logout confirmation modal with history clear
fix(overlay): prevent blink on mount when dark theme active
refactor(provider): centralize model config in ProviderRegistry
test(translation): add ClearAllTranslationsUseCase tests
```

## Pull Request Process

1. **Branch** — Create a feature branch from `main`:

   ```bash
   git checkout -b feat/my-feature
   ```

2. **Implement** — Make your changes following the coding standards above.

3. **Verify** — Ensure everything passes before pushing:

   ```bash
   bun run check    # Type checking
   bun run test     # All tests
   ```

4. **Submit** — Open a PR against `main` with:
   - A clear title following commit guidelines
   - A description of **what** changed and **why**
   - Screenshots for any UI changes

5. **Review** — Address review feedback promptly. Keep commits clean.

## Adding a New AI Provider

One of the most common contributions is adding support for a new AI provider. The checklist below covers **every file** that needs changes — follow it in order.

> [!IMPORTANT]
> New providers **must** support **multilingual image understanding** (vision) —
> Rosseta sends screenshots of selected regions for translation.
>
> Structured outputs (`json_schema` / response schema) are strongly preferred but
> **not required**: `executeTranslation()` detects a model that rejects the
> `json_schema` response format, caches it in `structuredOutputExemptModels`
> (keyed `provider:modelId`), and falls back to prompt-only JSON mode with a
> manual parse + repair retry on every later call.

### Domain layer

#### 1. Add to the `Provider` type

**File:** `src/core/domain/credential/Provider.ts`

- Add your provider ID to the `Provider` union type
- Add it to the `PROVIDERS` array

```typescript
export type Provider = 'google' | 'groq' | 'xai' | /* ... */ | 'your-provider';
export const PROVIDERS: Provider[] = ['google', 'groq', 'xai', /* ... */, 'your-provider'];
```

> [!NOTE]
> API keys are **not validated** and providers are picked explicitly in the UI — do not add key-format detection rules.

#### 2. Register the provider in `ProviderRegistry`

**File:** `src/core/domain/provider/ProviderRegistry.ts` — append a new `ProviderRegistry.register()` call at the bottom. Model lists start empty; they are populated at runtime from the provider API (or manual user input).

```typescript
ProviderRegistry.register({
  id: 'your-provider',
  name: 'Your Provider',
  defaultModelId: 'your-default-model',
  models: [],
});
```

### Adapter layer

#### 3. Create the translation adapter

Create `src/adapters/secondary/<provider>/YourProviderTranslationAdapter.ts`. For providers supported by the Vercel AI SDK, the adapter creates the `@ai-sdk/*` client, resolves the model id for **its own** provider, and delegates to the shared `executeTranslation()`. Copy an existing adapter such as [GroqTranslationAdapter.ts](src/adapters/secondary/groq/GroqTranslationAdapter.ts) and swap the client:

```typescript
import { createYourProvider } from '@ai-sdk/your-provider';

export class YourProviderTranslationAdapter implements ITranslationService {
  constructor(
    private readonly credential: Credential,
    private readonly userPreferences: UserPreferences,
    private readonly structuredOutputExemptions: IStructuredOutputExemptionStorage,
  ) {}

  public async translateImage(
    image: EncodedImage,
    targetLanguage: Language,
  ): Promise<Result<Translation, AppError>> {
    const client = createYourProvider({ apiKey: this.credential.apiKey.value });
    const model = client(
      this.userPreferences.getModelIdFor(this.credential.provider),
    );
    return executeTranslation(
      model,
      image,
      targetLanguage,
      'YOUR_PROVIDER', // uppercase log tag
      this.userPreferences.includeDescription,
      this.structuredOutputExemptions,
    );
  }
}
```

The prompt, response schema, parse/repair fallback, and domain mapping live in `src/adapters/secondary/shared/` — do not duplicate them per provider.

Providers that need a separate SDK may implement `ITranslationService` directly. Keep the same domain boundary and reuse the shared prompt, JSON parser, and response mapper. [PuterTranslationAdapter.ts](src/adapters/secondary/puter/PuterTranslationAdapter.ts) is the reference: it uses `@heyputer/puter.js`, sends the full response schema through `buildPlainPrompt()`, parses the returned JSON manually, and maps SDK errors to the existing `AppError` types. It authenticates with a user-created token from [Puter account settings](https://puter.com/#account); do not use `puter.auth.signIn()` from the extension popup because Puter does not accept extension URLs as sign-in origins.

#### 4. Wire into the adapter factory

**File:** `src/adapters/secondary/TranslationAdapterFactory.ts` — add a `case` for your provider in the switch statement (the `default` branch is an exhaustive `never` check, so TypeScript will remind you).

#### 5. Add model fetching

**File:** `src/adapters/secondary/model-fetchers/ModelFetchService.ts` — add your provider to the `MODEL_FETCHERS` record. If the provider exposes an OpenAI-compatible `/v1/models` endpoint, reuse `fetchOpenAICompatibleModels`. A provider-specific SDK can use its own model-list method. If it has no list endpoint, omit it — users add models manually.

Check the SDK's failure behavior before mapping errors. Puter's `ai.listModels()` returns an empty list when its endpoint or driver fails, so its fetcher first calls `auth.getUser()` to validate the token and surface an actionable authentication error.

### UI layer

#### 6. Add UI metadata

**File:** `src/adapters/primary/ui/shared/constants/providers.ts` — add a `PROVIDER_BADGE_COLORS` entry and the API key URL to `API_KEY_URLS`. If credential setup needs provider-specific guidance, add a short note to the Manage Keys page; PuterJS links users to its account page because its credential is an auth token.

The Manage Keys page reads the provider list straight from `PROVIDERS`, so no separate provider-list wiring is needed.

### Tests & fixtures

#### 7. Update tests

**File:** `src/adapters/secondary/TranslationAdapterFactory.test.ts` — add your provider class to the `expectedAdapters` map (the test loops over it and asserts the factory returns the right class for each provider).

**File:** `src/adapters/secondary/model-fetchers/ModelFetchService.test.ts` — cover your fetcher, including error status mapping.

**File:** `tests/test-fixtures.ts` — add a credential factory only if the e2e tests need one.

---

## Questions?

If something is unclear or you'd like to discuss a larger change before starting, open an issue and we'll figure it out together.

Happy contributing!
