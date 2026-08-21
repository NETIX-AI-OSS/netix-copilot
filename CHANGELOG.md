# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.0] — 2026-08-21

The first release written against a shipped backend rather than a blueprint, and against a real
adoption rather than an imagined one. cafm-v2-ui's PR #1734 could not use `CopilotDock` at all and
composed its own drawer out of the exported primitives; everything below is what that cost.

### Added

- **Controlled open state on `CopilotDock`.** `open` and `onOpenChange` let a host own the state,
  which is what a `?ai_open=1` URL contract, `?open_knowledge_base=1`, a topbar button and a
  `?thread=` deep link all need. Precedence is now explicit and tested: the `open` prop beats the
  stored value, the stored value beats `defaultOpen`. localStorage persistence stays, but only for
  the uncontrolled dock — a controlled host is never overwritten by a stale stored value.
- **`showLauncher`**, for a host that opens the dock from its own chrome and does not want the
  floating launcher as well.
- **`transformPrompt` adapter**, so what goes on the wire and what the user reads can differ.
  cafm-v2-ui appends `WORK_ORDER_ID: 4242` because the agentic contract has no scope field, and
  that suffix was appearing in the user's own chat bubble. The displayed text stays authoritative
  for the transcript; `CopilotTurnView.wirePrompt` records the difference without rendering it.
  `engine.send(prompt, scope, { wireText })` is the same split at the engine level, and
  `resolveCopilotPrompt` is the pure resolver behind both.
- **`result_data` tables.** `CopilotResultData` normalizes every shape the field comes back in —
  `{columns, data}`, `{columns, rows}`, positional rows, a bare list of row objects, a plain
  object, a scalar, or any of those stored as JSON text — and `ResultTable` renders it, capped at
  ten rows with a count of what is hidden, exactly as the drawer it replaces did.
- **Per-message badges.** `RunBadges` reports the run status, how long it took and which tools it
  used. `MessageView` renders both new surfaces by default; `showBadges={false}` and
  `showResultData={false}` opt a host out.
- **History replay.** `engine.selectThread(id)` now fetches and rebuilds the thread rather than
  clearing the panel, through a new optional `CopilotTransport.fetchThread`. A replayed turn
  carries its plan, its charts, its result table, its tools and its timing, so it renders through
  the same components as a turn that just finished. `engine.loadThread(id)` is the awaitable form,
  and `CopilotEngineState.threadLoading` reports the fetch.

### Fixed

- **Every step event rendered twice.** The decoder synthesized a step id per decoded step. ml-engine
  #316 sends `call_id` on both `step_started` and `step_result` and it is the only key stable
  across the pair, so it is now preferred over any other id and looked for at both nesting levels.
  Synthesis is the last resort it was always meant to be.
- **`chart` events were dropped on the streaming wire.** ml-engine emits `{ chart_config: … }`;
  the decoder looked for `option`, `options`, `chart`, `config` and `spec`, and silently discarded
  anything else. `chart_config` is now the first key it looks for.
- **`credits_remaining` was dropped by the poll transport.** ml-engine #316 computes it live and
  blends it into `usage` on both the SSE event and the REST payload; the agentic transport's usage
  mapper read only tokens, calls and cost. It now reads credits, the used count and the model, and
  the streaming decoder now reads calls and cost, which it had been dropping in the other
  direction. The stale comment in `usage-footer.tsx` claiming ml-engine never returns a credit
  balance is gone; the figure was always rendered when present, and now it arrives.
- **A failed step read as one still waiting.** The stored `plan` column is ml-engine's plan_trace,
  whose entries carry `in_progress`, `completed`, `errored` or `rejected`. Everything that was not
  `completed` collapsed to `pending`. `errored` is also now a decoder alias for `error`.
- **Copilot route paths.** Verified against ml-engine's `service/urls.py`, `service/views.py` and
  `service/copilot/sse.py` on `feat/copilot-w2-memory-and-actions`. The blueprint paths this SDK
  shipped with were wrong in every case except the request body:
  - approvals: `/api/copilot/turns/{id}/steps/{stepId}/approval/` → `/api/copilot-turn/{id}/steps/{stepId}/approval/`
  - cancel: `/api/copilot/turns/{id}/cancel/` → `/api/copilot-turn/{id}/cancel/`
  - stream: `/api/copilot/turns/{id}/stream/` → `/api/copilot/turn/{id}/events`
  - threads: `/api/copilot/threads/` → `/api/copilot-conversation/`
  - thread history: new, `/api/copilot-turn/?conversation={id}`
- **Thread list timestamps.** `ConversationSerializer` orders by and exposes `last_activity_at`,
  which the list decoder did not look at.

### Notes

- **The approval wire formats agree.** ml-engine #316 models an approval exactly as v0.1.0
  assumed: a `step_started` event whose step carries `status: "awaiting_approval"`, flat, keyed by
  `call_id`, with no twelfth event name and no alias. The decision endpoint accepts
  `{"approved": bool}` and/or `{"decision": "approve"|"reject"}` and prefers `approved` when both
  arrive, which is exactly what `SseTransport.respondToApproval` sends. Only the path was wrong.
- **`AgenticTransport.respondToApproval` still throws, and that is still right.** The poll resource
  surfaces no `awaiting_approval` step and serves no decision route, so there is nothing to record
  against; resolving quietly would tell a user a destructive action was authorised when nothing
  recorded it.
- **ml-engine's `result_data` field is effectively always null in production.**
  `AgenticMLRequestSerializer.get_result_data` scans `messages` for the Responses-API shape
  `{"type": "function_call_output"}`, while the live agent loop appends Chat-Completions messages
  `{"role": "tool", …}`. The only producers of the shape it looks for are ml-engine's own unit
  tests. The SDK reads the field when it is populated and otherwise falls back to the newest
  `execution_log[].output`, which is where the rows actually are. Worth a backend fix.
- **There is still no create-turn route on the streaming contract.** `POST /api/copilot/turns/`
  does not exist: a turn is opened through `POST /api/agentic-ml-request/`, whose response carries
  the `turn_id` to tail. `transport: 'auto'` therefore still resolves to the poll transport on the
  first send in every current cluster, exactly as it did in v0.1.0.

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
