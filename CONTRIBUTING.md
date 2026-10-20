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
│       ├── deepseek/ nvidia/      # native DeepSeek SDK + OpenAI-compatible NVIDIA
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
| `bun run test:streaming-sdk` | Actual AI SDK stream integration (isolated Vitest + Node) |
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

`test:streaming-sdk` is a third, isolated boundary suite. Its dedicated config loads the actual installed AI SDK without the Bun browser/SDK preload. `bun run test` runs all three suites; do not accidentally place ordinary UI or logic tests outside their existing runner paths.

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
- **Cohesive classes** — Give each class one purpose. Keep orchestration readable as named steps; extract a helper when it owns a distinct rule, resource, or transformation.
- **Small functions** — Use guard clauses and descriptive names to keep branching shallow. Share repeated behavior and constants; avoid speculative domains, generic frameworks, and one-line classes that only forward calls.

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
> **not required**. Streaming is also optional. The shared execution facade uses
> durable model/endpoint capability facts to choose a known working mode, or to
> learn from a real first request when support is unknown. Unsupported modes are
> skipped on later requests within a fixed 7-day compatibility window. The next
> real translation after expiry starts a fresh window. Successful Fetch Models
> refreshes compatibility for that provider; no background test requests are sent.

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
    private readonly capabilities: ITranslationCapabilityStorage,
  ) {}

  public async translateImage(
    image: EncodedImage,
    targetLanguage: Language,
    options?: TranslationExecutionOptions,
  ): Promise<Result<Translation, AppError>> {
    const client = createYourProvider({ apiKey: this.credential.apiKey.value });
    const model = client(
      this.userPreferences.getModelIdFor(this.credential.provider),
    );
    return executeTranslation(
      new AiSdkGenerationTransport(model),
      {
        providerId: this.credential.provider,
        modelId: this.userPreferences.getModelIdFor(this.credential.provider),
        protocol: providerProtocol(this.credential.provider),
      },
      image,
      targetLanguage,
      this.userPreferences.includeDescription,
      this.capabilities,
      options,
    );
  }
}
```

The prompt, response schema, capability-state selection, bounded fallback/repair, and domain mapping live in `src/adapters/secondary/shared/`. Keep them shared. Add the provider's actual endpoint/protocol to `translation-capability-key.ts` to preserve stable model/endpoint identity. Translation and the successful-fetch reset path must use the same opaque provider namespace, spanning that provider's model/endpoint scopes.

Declare SDK limitations through the adapter-local transport's `supportedModes`, without changing core contracts or saving those declarations as provider observations. The native `@ai-sdk/deepseek` client preserves image input, but its installed public configuration does not expose provider-enforced JSON Schema, so `DeepSeekTranslationAdapter` starts with plain JSON streaming and can fall back to buffered JSON. `NvidiaTranslationAdapter` uses `@ai-sdk/openai-compatible` with structured output enabled; the shared policy learns model-specific schema or streaming rejections. Both adapters retain complete response validation, bounded repair, and the existing compatibility refresh behavior.

Thinking controls are adapter-local request configurations. `native-thinking-configurations` and `gateway-thinking-configurations` select documented native off settings, then verified minimum effort where available, then an option-free provider default. Unknown models/endpoints remain unchanged. Do not send blanket portable `reasoning: 'none'`: installed SDKs can reject, remap, or silently drop it. [PROVIDER_THINKING_COMPATIBILITY.md](PROVIDER_THINKING_COMPATIBILITY.md) records the verified controls, model limits, and official sources.

`AiSdkGenerationTransport` applies the selected configuration in every mode, including repair. Common `providerOptions` and selected configuration options merge by namespace; `structuredProviderOptions` apply only to structured modes. A configuration-bound model factory uses `configured-generation-fetch` only when an installed SDK cannot forward a verified native field (currently OpenAI, Anthropic, and Mistral). Custom headers, query parameters, images, and cancellation must survive this override. Puter's transport forwards the selected native effort and preserves typed rejection metadata before application error mapping.

`TranslationConfigurationPolicy` chooses a known accepted configuration before an unknown one and skips rejected configurations. `generation-configuration-error` recognizes explicit rejection of an active control, including typed in-band provider errors; unrelated input, authentication, rate, account, and transient failures must not teach incompatibility. Retry the same generation mode with the next configuration when budget remains. Each translation permits at most three application-level generation invocations: the initial attempt and at most two additional attempts, shared across thinking configuration changes, schema/streaming fallback, buffered restart, and repair. All attempts share one absolute 60-second deadline. Keep schema/stream conflicts in the existing mode fallback. `TranslationCapabilityState` stores opaque configuration facts in the existing model/endpoint record, separate from schema and streaming facts, with the same fixed 7-day expiry, successful Fetch Models reset, failed-write retry, and stale-job protection. Preserve facts learned on the final allowed attempt even when no further fallback can run; combined incompatibilities may need the next real translation to reach a working path. Acceptance records a working request configuration; it cannot prove zero hidden reasoning. No provider-specific fields belong in core contracts or UI state.

For a separate SDK, implement the adapter-local `ITranslationGenerationTransport` and pass it to the same facade. Normalize its text/partial/error/completion behavior there; do not add provider-specific modes to core contracts or copy the fallback state machine. [PuterTranslationAdapter.ts](src/adapters/secondary/puter/PuterTranslationAdapter.ts) and its transport demonstrate this boundary. Puter authenticates with a token from [Puter account settings](https://puter.com/#account). Its native SDK access is serialized across translation and model fetching because authentication uses a singleton. Logical cancellation stops the app promptly, but the installed SDK cannot abort its submitted network request. The three-invocation cap does not bound raw HTTP requests because that SDK may retry internally.

### Translation contracts and responsibility boundaries

`ITranslationService` always returns `Promise<Result<Translation, AppError>>`. Optional execution options carry cancellation, an absolute deadline, and a provider-neutral progress observer. `reset` starts a replacement preview; `snapshot` carries a normalized `TranslationDraft`. A buffered provider can emit no snapshots and still fulfill this same contract. Provider support changes require no core command, use-case, UI, or messaging-contract edits.

The generated JSON contains `success`, nullable `error`, and nullable `data`. Successful data holds ordered `segments`, each with `blockIndex`, `originalText`, `translatedText`, `originalLanguageBcp47Code`, and nullable `romanization`. Description is generated last and omitted entirely from both prompt and schema when disabled. Required properties stay required for strict providers. Paired segments are normalized into the existing domain/history representation after complete validation. Partial JSON repair is for previews only.

`TranslateImageUseCase` validates input and invokes translation once. `SaveTranslationUseCase` persists a final result, `GetTranslationUseCase` loads one, and `ResetProviderCapabilitiesUseCase` clears one opaque namespace without contacting a provider. `FetchModelsHandler` composes model fetching and compatibility reset after a successful fetch; `FetchModelsUseCase` retains its model-catalog responsibility. The background preparer/coordinator manage extension lifecycle; SDK compatibility stays in secondary adapters. The existing modal controller class remains the sole reactive presentation state.

The streaming implementation separates the following responsibilities:

| Component | Purpose |
| --- | --- |
| `executeTranslation` | Compose preparation, provider attempts, complete validation, and final mapping under one execution scope. |
| `TranslationAttemptPolicy` | Choose modes and enforce fallback, restart, and repair budgets. |
| `TranslationConfigurationPolicy` | Choose accepted or unknown request configurations and skip rejected controls. |
| `TranslationAttemptPreview` | Buffer, parse, and publish provisional output from one attempt; discard its timer and callbacks when it ends. |
| `translation-completion` / `translation-response-normalizer` | Inspect completion and validate paired or legacy final data before domain mapping. |
| `TranslationCapabilityState` | Interpret feature and schema facts as mode support and translate provider observations into facts. |
| `TranslationCapabilityJournal` | Retain failed observations, retry writes, and prevent stale jobs from learning across a model-window or provider-namespace refresh. |
| `BrowserTranslationCapabilityStorage` | Serialize browser persistence and fixed-window/namespace refreshes; the codec validates stored records and merges facts. |
| `TranslationJobCoordinator` / `TranslationProgressPublisher` | Coordinate extension job stages and deliver ordered, acknowledged progress respectively. |
| `TranslationSession` / `TranslationModalController` | Own content-session ordering/liveness and reactive presentation respectively. Pure row transformations and clipboard I/O live in separate helpers. |

Keep these adapter responsibilities outside core use cases. Public provider contracts, final validation, cancellation boundaries, and durable capability identity must remain stable during readability refactors.

Custom-provider removal is one deletion operation: stage related reads, remove provider-owned credentials/catalog/model selection/key-rotation data, and delete the configuration last so failed cleanup can be retried. Popup snapshots refresh after deletion attempts; missing selected custom providers resolve to DeepSeek after provider hydration. History has a fixed 90-day retention policy based on creation time. Browser persistence physically prunes expired entries on worker startup and history access, including backup replacement, using a shared Web Lock across extension contexts and the existing queue fallback when unavailable. Keep these policies out of presentation code.

Capability facts are `unknown`, `supported`, or `unsupported`, with scoped evidence and observation time. Persist positive and negative observations. Within a compatibility window, select known-supported eligible paths before unknown paths and never probe an unsupported mode, including during repair. Model generations have a fixed 7-day refresh time; ordinary successful requests do not slide it forward. On expiry, clear positive and negative facts together so known-working selection cannot prevent rediscovery. Refresh happens lazily during real translation, without alarms or background generation. Successful Fetch Models advances that provider's namespace epoch, including manual models and models absent from the fetched list. Failed model fetching or catalog persistence preserves compatibility; a compatibility-reset failure after catalog persistence must be reported as a partial failure. The model list has no per-model Forget control. Both model and namespace generations prevent stale jobs or failed-write caches from restoring cleared facts. Provider namespaces are opaque to core and separate from model/endpoint identity. Bind older records lazily and honor namespace reset markers before importing legacy exclusions.

Store model-wide limitations separately from schema-specific facts so description/schema changes do not discard general observations within an active window. Transport mode declarations are current per-request constraints; do not persist them as permanent exclusions, and ignore obsolete stored declarations when an SDK now supports a mode. Do not infer incompatibility or trigger refresh from rate limits, authentication, malformed generations, or connection failures. Operational facts and refresh markers remain excluded from settings backups.

Live UI messages carry a request ID, document session, display revision, and sequence. They update locally registered modals only. Keep resets, acknowledgements, cancellation ownership, navigation, final-only copy/history, and commit-boundary tests when changing the flow. The pure final serializer lives in `src/shared/types/TranslationModalPayload.ts`; background imports must never pull injected modal components/styles into the worker bundle.

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
