# Translation generation

This module turns one image into an accepted translation through the existing `ITranslationService` port. Provider construction stays in `../providers`; browser jobs, history and modal delivery stay outside this module.

## Read the workflow

1. [TranslationServiceAdapter](TranslationServiceAdapter.ts) binds the resolved provider runtime and preferences.
2. [executeTranslation](execute-translation.ts) creates one execution scope, budget and compatibility view. It runs initial generation, inspects the completion, optionally requests one repair, then records acceptance and maps the domain result.
3. [generateWithFallback](execution/generate-with-fallback.ts) runs provider attempts for either intent. It awaits a preview reset, invokes the transport, disposes the attempt preview and handles classified failures.
4. [inspectGenerationCompletion](output/inspect-generation-completion.ts) tries the SDK object, final text and accumulated text before returning `accepted`, `repairable` or `failed`. It makes no network request.
5. [repairTranslationResponse](execution/repair-translation-response.ts) runs the same runner with a repair instruction and buffered modes. A second unusable completion ends repair; it cannot start another repair phase.

The runner returns the successful attempt's receipt, including its actual mode and configuration ID. Final compatibility recording uses that receipt, including after repair. A phase that cannot start is distinct from a provider invocation that failed: initial generation maps inability to start to request-rejected; repair maps it to malformed-response.

## Recovery vocabulary

| Operation              | Trigger                                                                     | Makes another generation invocation?                     |
| ---------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| Response recovery      | Another available representation already contains valid completed output    | No                                                       |
| Compatibility fallback | Explicitly rejected configuration, feature, mode or configuration/mode pair | Only if an eligible route remains                        |
| Transport retry        | An eligible temporary failure                                               | At most one buffered restart across both phases          |
| Response repair        | Completed output is unusable and termination permits repair                 | One logical repair phase, using the same fallback runner |

One repair phase can require multiple invocations. Every invocation shares the **six-call budget**, **one restart allowance**, **absolute 60-second deadline** and cancellation signal. Repair never receives fresh allowances.

## Ownership

| Question                                          | Owner                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Which phase runs next?                            | [execute-translation](execute-translation.ts) and [repair-translation-response](execution/repair-translation-response.ts)      |
| Which eligible route runs next?                   | [GenerationSelection](execution/generation-selection.ts)                                                                       |
| Is another invocation/restart allowed?            | [GenerationBudget](execution/generation-budget.ts)                                                                             |
| Has the operation expired or been cancelled?      | [translation-execution](execution/translation-execution.ts)                                                                    |
| What does a provider failure mean?                | [classify-generation-failure](errors/classify-generation-failure.ts)                                                           |
| What compatibility is known?                      | [TranslationCapabilityState](compatibility/TranslationCapabilityState.ts)                                                      |
| How are observations merged, reset and saved?     | [TranslationCapabilityJournal](compatibility/TranslationCapabilityJournal.ts), its facts/lifecycle helpers and browser storage |
| How are incomplete values displayed safely?       | [TranslationAttemptPreview](preview/TranslationAttemptPreview.ts) and the provisional parser/mapper                            |
| Is completed output acceptable?                   | [completion inspector](output/inspect-generation-completion.ts), final parser and normalizer                                   |
| How is accepted data turned into a domain result? | [translation-response-mapper](output/translation-response-mapper.ts)                                                           |

Selection owns route visitation, with compatibility checked for the current configuration. Budget owns counters. Neither owns repair text, JSON validation, persistence or timers. Repair intent supplies immutable previous response text and the prior route used for fallback preference.

## Error ownership

| Boundary                                | Responsibility                                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Transport                               | Decode native streams, errors, refusals and schema-rejected text; observe pending promises and honor cancellation.                     |
| `errors/provider-error-details.ts`      | Read bounded trusted SDK/provider envelopes and retry wrappers.                                                                        |
| `errors/classify-generation-failure.ts` | Return one exhaustive terminal, transient, configuration rejection, configuration/mode rejection, feature rejection or mode rejection. |
| Runner                                  | Apply that classification through selection, budget and compatibility observations.                                                    |
| Preview/reset delivery                  | Propagate the original local failure; preview failures abort the shared scope.                                                         |
| Output processing                       | Recover/validate output and interpret termination without classifying provider support.                                                |
| Outer execution boundary                | Preserve an abort reason or existing `AppError`; convert other local exceptions with `AppError.fromUnknown`.                           |

Provider classification surrounds only the native invocation. Request construction, progress reset, compatibility persistence, completion inspection and domain mapping stay outside that catch. Their failures cannot teach provider incompatibility or trigger a provider retry. Puter may consult the pure classification facade at its native mapping bridge to preserve evidence; it does not run recovery or write observations.

## Contracts to preserve

- Keep prompt strings and serialized request schemas unchanged during structural refactors. Schema digests participate in compatibility identity.
- Keep strict outgoing schemas separate from tolerant receipt schemas and normalized completed data in [translation-schema](output/translation-schema.ts).
- Keep final and partial parsing separate. A draft can contain unfinished rows; accepted output must satisfy final envelope, segment, block and termination rules. History and copying receive accepted results only.
- Share the limits in [translation-response-limits](output/translation-response-limits.ts): 1 MiB of UTF-8 text and 2,048 segments. Raw limits apply before dropping an unsolicited disabled description.
- Accept valid completed candidates only with `stop`. Missing/unknown termination is never invented as success; `length` can require repair even when JSON is balanced.
- Preserve compatibility keys, seven-day fixed windows, reset generations and failed-write recovery. Authentication, access, quota, input, network and malformed output must not become negative capability facts.
- Dispose each attempt's preview before another invocation. Late work from a disposed attempt cannot cancel its replacement.

## Common changes and tests

Change prompt/schema behavior in `output/` together with final and preview mapping tests. Change route order in selection tests and retain execution/configuration integration cases. Add exact redacted provider error fixtures at the classifier, then verify cached fallback behavior through the runner. Use the isolated installed-SDK suite for serialization and native stream behavior; Bun's SDK mocks do not verify that boundary.

Run targeted Bun tests while editing. Integrated verification remains `bun run format:check`, `bun run lint`, `bun run check`, all three test suites and `bun run build:prod`. No tests make paid/live provider calls.

See [the maintainer guide](../../../../docs/MAINTAINER_GUIDE.md), [contributing](../../../../CONTRIBUTING.md) and [the phase/error ownership decision](../../../../docs/decisions/0005-explicit-generation-phases.md).
