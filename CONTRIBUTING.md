# Contributing to Rosseta

Thank you for your interest in contributing! This document provides everything you need to get started, from setting up your environment to submitting your first pull request.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
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
│  │  background   │  │  gemini  │  │  Svelte 5 + TW4  │  │
│  │  content      │  │  groq    │  │  extension popup │  │
│  │              │  │  zai     │  │  injected overlay│  │
│  │              │  │  storage  │  │                  │  │
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
│   │   ├── credential/            # ApiKey, Credential, Credentials
│   │   ├── preferences/           # UserPreferences, AiModel, Theme
│   │   ├── provider/              # ProviderRegistry (models, languages)
│   │   └── translation/           # Translation, Language, TextSegment
│   ├── application/               # Use cases (one class per action)
│   │   ├── auth/                  # Add/Remove API keys, set active key
│   │   ├── preferences/           # Get/Update user preferences
│   │   └── translation/           # Save, Get, Delete, ClearAll translations
│   └── ports/
│       ├── inbound/               # Use case interfaces (driven side)
│       └── outbound/              # Storage & service interfaces (driving side)
│
├── adapters/
│   ├── primary/                   # Entry points (driving adapters)
│   │   ├── background/            # Service worker handlers
│   │   ├── content/               # Content script (overlay, toast, modal)
│   │   └── ui/
│   │       ├── extension/         # Popup UI (pages, components)
│   │       ├── injected/          # In-page translation modal
│   │       └── shared/            # Hooks, context, constants, components
│   └── secondary/                 # Infrastructure (driven adapters)
│       ├── gemini/                # Gemini API client
│       ├── groq/                  # Groq API client
│       ├── zai/                   # Z.ai API client
│       ├── storage/               # Browser storage adapters
│       └── validation/            # API key validation
│
├── shared/                        # Cross-cutting concerns
│   ├── di/                        # Dependency injection container
│   ├── errors/                    # AppError hierarchy (typed error codes)
│   ├── messaging/                 # Runtime message helpers
│   └── types/                     # Result<T, E>, shared type utilities
│
└── tests/
    └── fakes/                     # In-memory test doubles
```

## Development Workflow

### Available Scripts

| Command                     | Description                                     |
| --------------------------- | ----------------------------------------------- |
| `bun run build:dev:chrome`  | Development build with watch mode (Chrome)      |
| `bun run build:dev:firefox` | Development build with watch mode (Firefox)     |
| `bun run build:prod`        | Production build for both browsers              |
| `bun run test:logic`        | Run domain, application, and adapter unit tests |
| `bun run test:ui`           | Run Svelte component tests (Vitest + jsdom)     |
| `bun run test`              | Run all tests                                   |
| `bun run check`             | Type-check Svelte files and Node config         |

### Recommended Dev Loop

```bash
# Terminal 1: Watch build
bun run build:dev:chrome

# Terminal 2: Run tests on change
bun test --watch src/core src/adapters

# Before committing
bun run check && bun run test
```

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

One of the most common contributions is adding support for a new AI provider. Here's the step-by-step:

> [!IMPORTANT]
> New providers **must** support:
>
> 1. **Multilingual image understanding** (vision) — Rosseta sends screenshots of selected regions for translation
> 2. **Structured outputs** (JSON mode / response schema) — Rosseta expects a typed JSON response from the model

### 1. Register in `ProviderRegistry`

```typescript
// src/core/domain/provider/ProviderRegistry.ts

ProviderRegistry.register({
  id: 'openai',
  name: 'OpenAI',
  defaultModelId: 'gpt-4o-mini',
  models: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ],
  supportedLanguages: ['en-US', 'ja-JP', 'ko-KR', 'zh-CN', ...],
});
```

> [!NOTE]
> Use **BCP 47** language-region codes (e.g. `en-US`, `ja-JP`, not `en`, `ja`). If your provider supports a language not yet in `src/core/domain/translation/LANGUAGE_MAP.ts`, add it there first.

### 2. Update the `Provider` type

```typescript
// src/core/domain/credential/Provider.ts
export type Provider = 'gemini' | 'groq' | 'zai' | 'openai';
```

### 3. Create the adapter

```
src/adapters/secondary/openai/
├── OpenAiTranslationAdapter.ts    # Implements ITranslationService
├── OpenAiTranslationAdapter.test.ts
├── prompt.ts                      # Provider-specific prompt builder
└── schema.ts                      # Zod response schema
```

### 4. Wire into the DI container

Update `src/shared/di/container-factory.ts` to construct and expose the new adapter.

### 5. Add API key validation

Update `HttpApiKeyValidator` to detect and validate the new provider's key format.

### 6. Register in the provider cycle

Add the new provider to the `PROVIDERS` array in `src/adapters/primary/ui/shared/hooks/useProviderCycle.svelte.ts` with its name and API key URL. This makes the login and manage-keys UI cycle through the new provider automatically.

---

## Questions?

If something is unclear or you'd like to discuss a larger change before starting, open an issue and we'll figure it out together.

Happy contributing! 🚀
