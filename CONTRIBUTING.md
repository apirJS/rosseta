# Contributing to Rosseta

Rosseta is a Chrome/Firefox Manifest V3 extension built with TypeScript, Bun, Svelte 5, Tailwind CSS and ports/adapters. Start with the [maintainer guide](docs/MAINTAINER_GUIDE.md) for ownership and a short translation reading path.

## Setup

Use Bun 1.4.2 or the version configured by CI. The release workflow uses Node 22.

```bash
bun install
bun run dev:chrome
# Or:
bun run dev:firefox
```

Load `dist/chrome` as an unpacked extension. For Firefox, load `dist/firefox/manifest.json` through `about:debugging`. Popup development uses HMR; background/content entries rebuild separately. Keep the root-absolute popup script URL in its HTML entry.

| Command                                          | Purpose                                                   |
| ------------------------------------------------ | --------------------------------------------------------- |
| `bun run dev:chrome` / `dev:firefox`             | Development server for the selected browser               |
| `bun run build:dev:chrome` / `build:dev:firefox` | Watch development builds                                  |
| `bun run build:prod`                             | Production Chrome and Firefox builds                      |
| `bun run format`                                 | Format maintained source, configuration and documentation |
| `bun run format:check`                           | Check formatting without changing files                   |
| `bun run lint`                                   | Oxlint with warnings treated as failures                  |
| `bun run check`                                  | Svelte and TypeScript checks                              |
| `bun run test`                                   | Logic, Svelte UI and installed-SDK suites                 |

## Architecture

Dependencies point inward. Core depends on framework-free core/shared code; adapters depend on core. Composition constructs concrete dependencies and passes small named dependency objects to feature logic.

```text
src/core/
  domain/                Immutable values, entities and pure selection rules
  application/
    translation/         Resolve configuration; validate and translate input
    history/             Save, query and delete final results
    providers/           Custom configuration and model catalog actions
    credentials/         API keys and key selection
    preferences/ settings/ shortcuts/
  ports/                 Inbound actions; outbound persistence/services
src/adapters/primary/
  background/            Browser jobs, capture, handlers and messaging
  content/               Content sessions, capture, Shadow DOM and messaging
  ui/                    Svelte components, controllers, contexts and popup lifetime
src/adapters/secondary/
  translation/           Shared generation engine, output, previews, compatibility
    transports/ai-sdk/   Installed AI SDK integration and its option types
  providers/             Explicit factories, native controls, requests, catalogs, Puter
  storage/               Browser storage grouped by capability
src/composition/         Background/popup roots and storage constructors
src/shared/              Result, errors, wire contracts and pure serialization
```

The background root is [background.ts](src/composition/background.ts). The popup root is [popup.ts](src/composition/popup.ts); it does not construct provider/network clients. Storage constructors live in [storage.ts](src/composition/storage.ts). Feature code must not import a composition root.

One generation engine serves all providers. Provider factories supply a transport and compatibility context; generic execution does not discover providers. Browser job ownership stays in primary adapters. Core translation validates input and calls `ITranslationService` once; history is a separate action.

Immutable [provider definitions](src/core/domain/provider/provider-definitions.ts) are separate from persisted catalogs and reactive popup snapshots. [model-selection.ts](src/core/domain/preferences/model-selection.ts) owns the pure effective-model rule. No global mutable model registry is used.

Read the [architecture decisions](docs/decisions/0001-capability-organization.md) before changing these boundaries.

## Coding conventions

Run `bun run format` before submitting changes. Prettier owns formatting, including Svelte scripts, templates and styles. The shared configuration uses single quotes and LF line endings; `.prettierignore` excludes generated output and local artifacts. Markdown code examples retain their original formatting.

- Use strict TypeScript and `unknown` instead of `any`; use `import type` for types.
- Return `Result<T, AppError>` from application actions and storage adapters for expected failures. Convert unknown exceptions at adapter boundaries and use existing error subclasses.
- Give a class one purpose. Extract a function when it owns a meaningful rule, transformation or resource. Share actual repetition; avoid speculative frameworks and forwarding-only classes.
- Use one use-case file per coherent public action. Internal retry, parser, transport and rendering steps do not each need an application action.
- Keep port interfaces `I`-prefixed. Prefer contract tests with the in-memory fakes in `tests/fakes`.
- Use Svelte 5 runes, a `Props` interface, typed component context and controller-owned reactive logic. Keep components presentational and async initialization/disposal explicit.
- Use Tailwind semantic tokens (`bg-background`, `text-foreground`, `border-border`). Verify both themes for UI changes. Inject page UI through the Shadow DOM host.
- Keep one canonical implementation of queues, journals, leases and other resource owners. Remove temporary migration shims after callers move.

## Tests and verification

Tests are colocated unless they deliberately exercise the installed SDK boundary. Discovery is path-based; a test moved to the wrong scope can otherwise disappear.

| Runner                       | Owned files                                                                            | Test import |
| ---------------------------- | -------------------------------------------------------------------------------------- | ----------- |
| `bun run test:logic`         | `src/core`, `src/shared`, `src/composition`, background/content and secondary adapters | `bun:test`  |
| `bun run test:ui`            | `src/adapters/primary/ui`, including `.svelte.ts` controllers                          | `vitest`    |
| `bun run test:streaming-sdk` | `tests/*-sdk-integration.test.ts`                                                      | `vitest`    |

Bun's browser preload mocks browser/Svelte/SDK boundaries. The installed-SDK suite uses its isolated Node configuration and the actual installed SDK. Do not put rune tests in Bun or infer real SDK behavior from its mocked suite.

```bash
bun test src/core/application/history/ClearAllTranslationsUseCase.test.ts
bunx vitest run src/adapters/primary/ui/extension/pages/manage-keys/ManageKeysController.test.ts
bun run test:streaming-sdk
```

Test observable behavior, including relevant errors, cancellation and stale work. Use deterministic fixtures for provider requests, streams and errors; tests do not make paid/live API calls. When moving files, update runner paths, mock-module paths, imports and configs together, then confirm the moved tests appear in the runner's output.

Before accepting an integrated change, run:

```bash
bun run format:check
bun run lint
bun run check
bun run test
bun run build:prod
git diff --check
```

PR checks run `lint`, `test`, `typecheck` and `build`. The existing required **Verify & Test** job aggregates them and fails if a required job fails or is skipped. Outside-collaborator workflow approvals and CODEOWNERS review remain in place.

## Adding a provider

Rosseta needs image/vision input. Structured output and streaming are optional: the shared engine learns actual support and falls back. Do not add provider-specific fields to core translation, UI or wire contracts.

1. **Add its identity and immutable metadata.** Update [Provider.ts](src/core/domain/credential/Provider.ts) and [provider-definitions.ts](src/core/domain/provider/provider-definitions.ts). Default model IDs are hints, not live catalogs. Credentials are explicitly assigned to providers; do not guess providers from key prefixes.
2. **Create a focused runtime factory.** Add a function under [providers/builtin](src/adapters/secondary/providers/builtin), following [groq-runtime.ts](src/adapters/secondary/providers/builtin/groq-runtime.ts). It receives explicit credential/model inputs and returns `{ transport, context }`. Use the existing `createProviderContext` helper to preserve identity composition. For custom protocols, see [providers/custom](src/adapters/secondary/providers/custom).
3. **Wire construction.** Add an exhaustive case to [create-provider-runtime.ts](src/adapters/secondary/providers/create-provider-runtime.ts). Reuse `TranslationServiceAdapter`; do not add another provider-specific `ITranslationService` wrapper or copy generation logic.
4. **Declare endpoint/protocol identity and catalog networking.** Update [translation-capability-key.ts](src/adapters/secondary/translation/compatibility/translation-capability-key.ts) without changing existing identities. Add model discovery in [ModelFetchService.ts](src/adapters/secondary/providers/catalogs/ModelFetchService.ts); reuse existing protocol helpers where appropriate. Preserve headers/query parameters and error mapping. If no list API exists, users can add models manually.
5. **Declare verified request controls.** Add documented native disable/minimum settings in [providers/thinking](src/adapters/secondary/providers/thinking), then have the factory inject declarations through `createProviderSdkTransport`. Unknown models/endpoints keep native defaults. If the installed SDK silently omits a verified field, use a configuration-bound model factory and [configured-generation-fetch.ts](src/adapters/secondary/providers/requests/configured-generation-fetch.ts). Preserve cancellation, images, custom headers and query parameters. Record official sources in [PROVIDER_THINKING_COMPATIBILITY.md](PROVIDER_THINKING_COMPATIBILITY.md).
6. **Add presentation metadata.** Update badge colors and credential setup URLs in [providers.ts](src/adapters/primary/ui/shared/constants/providers.ts). Add provider-specific instructions only when setup differs.
7. **Verify actual boundaries.** Extend [create-provider-runtime.test.ts](src/adapters/secondary/providers/create-provider-runtime.test.ts), catalog tests and request/control fixtures. Use the installed-SDK suite for serialization/stream behavior. Run lint, type checks, tests and both builds. Follow the same shared fallback contract rather than changing core/UI contracts.

A native non-AI-SDK client implements [ITranslationGenerationTransport](src/adapters/secondary/translation/transports/GenerationTransport.ts). Normalize that SDK's events/errors/completion at the transport boundary. [PuterGenerationTransport.ts](src/adapters/secondary/providers/puter/PuterGenerationTransport.ts) is an example with an explicit shared authentication lease. Puter translation/catalog calls serialize because its auth client is a singleton; logical cancellation does not abort already submitted native requests, and its SDK may retry HTTP internally.

DeepSeek uses its native SDK and declares the installed transport's plain-JSON modes. NVIDIA uses OpenAI-compatible construction. Transport declarations are per-request SDK constraints, not permanent incompatibility facts.

## Contracts to preserve

- `ITranslationService` returns `Promise<Result<Translation, AppError>>`. Optional execution options carry cancellation, an absolute deadline and a provider-neutral progress observer. Buffered providers may emit no snapshots.
- The shared engine permits at most **six** generation invocations across initial request, control/mode fallback, restart and repair, all within one **60-second** generation deadline. Stop on success and retain existing restart/repair eligibility rules. Six is not an exhaustive preflight and does not bound an SDK's internal HTTP retries.
- Persist both positive and negative compatibility evidence. A fixed **7-day** window refreshes lazily on a real translation. Successful catalog refresh resets the provider namespace after catalog persistence; failures before persistence retain compatibility. Report a reset failure after a saved catalog as partial failure.
- Explicit control/feature rejection may teach incompatibility. Authentication, quota, invalid input, network/transient errors and malformed JSON must not. Keep general model facts separate from schema-specific and configuration facts; preserve reset generations and failed-write recovery.
- Generated output pairs source and translated text in ordered segments. Description is omitted entirely when disabled. Partial JSON parsing is provisional; final response acceptance stays strict. History and copying use accepted final results only.
- Browser messages preserve trusted sender/document ownership, request IDs, revisions, sequence/ack ordering, cancellation and terminal recovery. Update the schema union, return map and receiving router together for a new action.
- History uses creation-time **90-day** retention and serialized browser writes. Preserve its Web Lock/queue fallback. Custom-provider removal cascades related data before deleting its configuration. Manage Keys commits earlier deletes in sequence; Undo targets the latest pending key.
- Persisted keys/codecs, compatibility identities, wire payloads, prompts/schema behavior and backup formats are contracts. A structural refactor does not silently migrate them. Compatibility operational facts are excluded from backups.

## Pull requests and releases

Use Conventional Commits such as `fix(keys): serialize consecutive deletions` or `refactor(translation): group generation ownership`. Explain the concrete behavior/problem, the change and relevant validation; include screenshots for UI changes.

Submit PRs against `main`, address review feedback and keep unrelated changes separate. Semantic release owns versioning on `main`/`beta`, updates the extension manifest and builds/packages both targets. Do not hand-edit package or manifest versions.
