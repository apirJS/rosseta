# Deterministic translation providers

Run from the repository root in a separate terminal:

```powershell
bun tests/fixtures/translation-provider-server.ts
```

The server binds only `127.0.0.1:8787`. No real provider credentials or external network calls are needed. Use a disposable value such as `fixture-key` as the custom provider API key and select/add model `fixture-vision`.

Create a custom provider using either protocol:

| Custom provider type | Base URL example |
| --- | --- |
| OpenAI compatible | `http://127.0.0.1:8787/openai/success/v1` |
| Anthropic compatible | `http://127.0.0.1:8787/anthropic/success/v1` |

Replace `success` with a scenario below. Each scenario has its own endpoint identity, so capability facts remain isolated. The response contains two multilingual visual blocks; image contents do not affect these deterministic outputs. Description on/off is respected.

| Scenario | Expected behavior |
| --- | --- |
| `success` | Structured streaming with partial text before completion. |
| `no-structured` | Structured request rejected; plain JSON streaming succeeds. |
| `unavailable-response-format` | Captured HTTP 400 unavailable-format rejection; plain streaming succeeds and is reused directly on later requests. |
| `no-stream` | Streaming rejected; structured buffered output succeeds. |
| `buffered-only` | Structured output and streaming rejected; plain buffered generation succeeds. |
| `combined-only` | Structured streaming rejected; plain streaming succeeds without disabling structured buffered support. |
| `malformed-repair` | Initial normal completion is malformed; one buffered repair succeeds. |
| `in-band-error` | Stream reports an error after partial text; eligible buffered restart succeeds. |
| `interruption` | Stream fails after partial text; eligible buffered restart succeeds. |
| `no-text` | Valid no-text envelope; no draft history entry. |
| `no-vision` | Definitive unsupported image input; later translations fail locally until compatibility is explicitly reset. |
| `slow-headers` | Headers wait 65 seconds; shared deadline ends the job. |
| `silence` | Stream starts, then waits 65 seconds between chunks; shared deadline ends the job. |

Add optional custom header `X-Fixture-Route: test` and query parameter `fixture-route=test` to verify options survive every fallback. The [request log](http://127.0.0.1:8787/__requests) records protocol, scenario, model, structured/stream flags, repair flag, and whether those routing options were present. It never records authorization, header/query values, prompts, images, or request bodies.

For durable fallback verification:

1. Translate against `buffered-only`. The log should show structured stream, plain stream, plain buffered.
2. Restart/reload the extension and translate with the same provider and model. Only plain buffered should be added.
3. Toggle description and repeat within 7 days. The known general limitations should still select plain buffered directly.
4. Click **Fetch Models** for that provider. Its model-list request is expected; no generation request should be logged until the next translation. That translation rediscovers support. Compatibility also refreshes on the first real translation after a fixed 7-day window; ordinary successful translations do not extend the window.
5. Reopen history and verify only final validated results were saved. Close during preview/fallback to check cancellation and absence of a resurrected modal.

Clear only the fixture request log with `Invoke-RestMethod -Method Post http://127.0.0.1:8787/__reset`. This does not erase extension capability records. Stop the server with Ctrl+C. Override the port by setting `PORT` before launch.

The isolated `test:streaming-sdk` suite also drives this handler through the actual installed OpenAI/Anthropic SDK clients and production execution facade. Bun unit tests separately exercise native Puter chunks, fallback/repair, cancellation, and the shared credential lease. The local HTTP fixture does not emulate Puter's authenticated native SDK.
