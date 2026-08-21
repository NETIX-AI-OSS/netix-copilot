# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] — 2026-08-21

Initial release.

### Added

- `CopilotProvider` plus the host adapter contract: page context, chart renderer, permission
  check, translate function and theme tokens. No data-layer adapter, because the SDK owns its
  own fetch and depends on neither SWR nor react-query.
- Components: persistent resizable dock, thread list, composer, streaming markdown message view,
  plan/step timeline, approval cards and usage footer.
- Two transports behind one event vocabulary: `SseTransport` for the streaming turn contract, and
  `AgenticTransport` for the `agentic-ml-request` create-then-poll contract ml-engine serves
  today. `AutoTransport` probes streaming once and degrades permanently on a missing route.
- Hand-written SSE parser over `fetch()` + `ReadableStream`, with `Last-Event-ID` resume. Native
  `EventSource` is unusable because it cannot set an `Authorization` header and the gateway's
  ext_authz filter has no cookie fallback.
- A markdown renderer built for partial documents, so an unclosed fence still renders as code and
  an unclosed emphasis marker stays literal instead of swallowing the answer. Keeps
  `react-markdown` out of the dependency tree.
- `COPILOT_Z_INDEX`, a 60000-band stacking scale measured against what the host apps actually
  paint rather than assumed.

### Notes

- The streaming routes do not exist on ml-engine yet; verified 2026-08-21. `auto` therefore
  resolves to the agentic transport in every current cluster.
- `plan` is treated as optional throughout: ml-engine's direct router answers single-domain
  prompts without consulting the orchestrator, so a healthy run may never emit one.
- Built output is committed, mirroring `envoy-ts-auth`, so `github:` consumers need no build step.
- `target` is ES2020 rather than envoy-ts-auth's ES2016, the one deliberate tsconfig deviation:
  this package is stream-heavy and the ES2016 downlevel wraps every read in a generator
  trampoline. Everything else about the build mirrors that package.
